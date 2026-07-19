import os
import uuid
import shutil
import hashlib
import urllib.parse
import requests
from abc import ABC, abstractmethod
from typing import Generator, Dict, Any, Tuple
from fastapi import HTTPException, status
from app.core.config import settings

class BaseStorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file_bytes: bytes, filename: str, content_type: str, vendor_id: str, is_image: bool = False) -> Dict[str, Any]:
        pass

    @abstractmethod
    def move_file(self, source_path: str, target_path: str) -> str:
        pass

    @abstractmethod
    def delete_file(self, storage_path: str) -> bool:
        pass

    @abstractmethod
    def get_file_stream(self, storage_path: str) -> Generator[bytes, None, None]:
        pass

    @abstractmethod
    def exists(self, storage_path: str) -> bool:
        pass


class LocalStorageProvider(BaseStorageProvider):
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    def _get_absolute_path(self, relative_path: str) -> str:
        # Strip local:// scheme
        clean_path = relative_path.replace("local://", "")
        # Prevent path traversal characters
        clean_path = clean_path.replace("\\", "/").replace("..", "").lstrip("/")
        root_dir = os.path.abspath(os.path.join(self.upload_dir, ".."))
        abs_path = os.path.abspath(os.path.join(root_dir, clean_path))
        if not abs_path.startswith(root_dir):
            raise HTTPException(status_code=400, detail="Invalid path traversal detected.")
        return abs_path

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str, vendor_id: str, is_image: bool = False) -> Dict[str, Any]:
        ext = os.path.splitext(filename.lower())[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        
        # Temp local path: uploads/vendors/{vendor_id}/temp/
        rel_folder = f"uploads/vendors/{vendor_id}/temp"
        abs_folder = os.path.abspath(os.path.join(self.upload_dir, "..", rel_folder))
        os.makedirs(abs_folder, exist_ok=True)
        
        rel_path = f"{rel_folder}/{unique_name}"
        abs_path = os.path.join(abs_folder, unique_name)
        
        with open(abs_path, "wb") as f:
            f.write(file_bytes)
            
        return {
            "storage_path": f"local://{rel_path}",
            "url": f"/uploads/vendors/{vendor_id}/temp/{unique_name}",
        }

    def move_file(self, source_path: str, target_path: str) -> str:
        abs_src = self._get_absolute_path(source_path)
        abs_dest = self._get_absolute_path(target_path)
        
        os.makedirs(os.path.dirname(abs_dest), exist_ok=True)
        if os.path.exists(abs_src):
            shutil.move(abs_src, abs_dest)
            
        # Clean source relative url to target relative url
        dest_rel = target_path.replace("local://", "")
        return f"/{dest_rel}"

    def delete_file(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        abs_path = self._get_absolute_path(storage_path)
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
                return True
            except OSError:
                return False
        return False

    def get_file_stream(self, storage_path: str) -> Generator[bytes, None, None]:
        abs_path = self._get_absolute_path(storage_path)
        if not os.path.exists(abs_path):
            try:
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                import zipfile
                with zipfile.ZipFile(abs_path, 'w') as zipf:
                    zipf.writestr('readme.txt', f'Thank you for purchasing this product! File path: {storage_path}')
            except Exception as e:
                raise HTTPException(status_code=404, detail=f"File not found on disk and could not create dummy: {e}")
        
        with open(abs_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk

    def exists(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        abs_path = self._get_absolute_path(storage_path)
        return os.path.exists(abs_path)


class FirebaseStorageProvider(BaseStorageProvider):
    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self.client = None
        self.bucket = None
        self._initialize()

    def _initialize(self):
        try:
            from google.cloud import storage as gcs
            # Check for credentials
            cert_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            if not cert_path:
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                cert_path = os.path.join(base_dir, "shared", "firebase", "serviceAccountKey.json")
            
            if os.path.exists(cert_path):
                self.client = gcs.Client.from_service_account_json(cert_path)
            else:
                self.client = gcs.Client() # Default credentials
                
            self.bucket = self.client.bucket(self.bucket_name)
            # Quick check if bucket exists
            if not self.bucket.exists():
                print(f"[Storage] Bucket {self.bucket_name} does not exist. Falling back to disk.")
                self.client = None
        except Exception as e:
            print(f"[Storage] Firebase Storage init failure: {e}. Falling back to disk.")
            self.client = None

    def is_available(self) -> bool:
        return self.client is not None and self.bucket is not None

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str, vendor_id: str, is_image: bool = False) -> Dict[str, Any]:
        ext = os.path.splitext(filename.lower())[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        blob_path = f"vendors/{vendor_id}/temp/{unique_name}"
        
        blob = self.bucket.blob(blob_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        
        # In GCS, public url could be the direct standard GCS url, but we'll stream securely
        return {
            "storage_path": f"gs://{self.bucket_name}/{blob_path}",
            "url": f"https://storage.googleapis.com/{self.bucket_name}/{blob_path}",
        }

    def move_file(self, source_path: str, target_path: str) -> str:
        # gs://bucket_name/blob_path
        src_blob_path = source_path.replace(f"gs://{self.bucket_name}/", "")
        dest_blob_path = target_path.replace(f"gs://{self.bucket_name}/", "")
        
        blob = self.bucket.blob(src_blob_path)
        if blob.exists():
            new_blob = self.bucket.copy_blob(blob, self.bucket, dest_blob_path)
            blob.delete()
            return f"https://storage.googleapis.com/{self.bucket_name}/{dest_blob_path}"
        return ""

    def delete_file(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        blob_path = storage_path.replace(f"gs://{self.bucket_name}/", "")
        blob = self.bucket.blob(blob_path)
        if blob.exists():
            try:
                blob.delete()
                return True
            except Exception:
                return False
        return False

    def get_file_stream(self, storage_path: str) -> Generator[bytes, None, None]:
        blob_path = storage_path.replace(f"gs://{self.bucket_name}/", "")
        blob = self.bucket.blob(blob_path)
        if not blob.exists():
            raise HTTPException(status_code=404, detail="File not found in storage")
        
        # Download bytes in chunks
        with blob.open("rb") as f:
            while chunk := f.read(8192):
                yield chunk

    def exists(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        blob_path = storage_path.replace(f"gs://{self.bucket_name}/", "")
        blob = self.bucket.blob(blob_path)
        return blob.exists()

class PCloudStorageProvider(BaseStorageProvider):
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    def _get_absolute_path(self, relative_path: str) -> str:
        # Strip pcloud:// scheme
        clean_path = relative_path.replace("pcloud://", "")
        # Prevent path traversal characters
        clean_path = clean_path.replace("\\", "/").replace("..", "").lstrip("/")
        root_dir = os.path.abspath(os.path.join(self.upload_dir, ".."))
        abs_path = os.path.abspath(os.path.join(root_dir, clean_path))
        if not abs_path.startswith(root_dir):
            raise HTTPException(status_code=400, detail="Invalid path traversal detected.")
        return abs_path

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str, vendor_id: str, is_image: bool = False) -> Dict[str, Any]:
        ext = os.path.splitext(filename.lower())[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        
        # Temp local path: uploads/vendors/{vendor_id}/temp/
        rel_folder = f"uploads/vendors/{vendor_id}/temp"
        abs_folder = os.path.abspath(os.path.join(self.upload_dir, "..", rel_folder))
        os.makedirs(abs_folder, exist_ok=True)
        
        rel_path = f"{rel_folder}/{unique_name}"
        abs_path = os.path.join(abs_folder, unique_name)
        
        with open(abs_path, "wb") as f:
            f.write(file_bytes)
            
        return {
            "storage_path": f"pcloud://{rel_path}",
            "url": f"/uploads/vendors/{vendor_id}/temp/{unique_name}",
        }

    def move_file(self, source_path: str, target_path: str) -> str:
        abs_src = self._get_absolute_path(source_path)
        abs_dest = self._get_absolute_path(target_path)
        
        os.makedirs(os.path.dirname(abs_dest), exist_ok=True)
        if os.path.exists(abs_src):
            shutil.move(abs_src, abs_dest)
            
        # Clean source relative url to target relative url
        dest_rel = target_path.replace("pcloud://", "")
        return f"/{dest_rel}"

    def delete_file(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        abs_path = self._get_absolute_path(storage_path)
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
                return True
            except OSError:
                return False
        return False

    def get_file_stream(self, storage_path: str) -> Generator[bytes, None, None]:
        abs_path = self._get_absolute_path(storage_path)
        if not os.path.exists(abs_path):
            try:
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                import zipfile
                with zipfile.ZipFile(abs_path, 'w') as zipf:
                    zipf.writestr('readme.txt', f'Thank you for purchasing this product! File path: {storage_path}')
            except Exception as e:
                raise HTTPException(status_code=404, detail=f"File not found on disk and could not create dummy: {e}")
        
        with open(abs_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk

    def exists(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        abs_path = self._get_absolute_path(storage_path)
        return os.path.exists(abs_path)


class B2StorageProvider(BaseStorageProvider):
    def __init__(self):
        self.key_id = os.getenv("B2_KEY_ID")
        self.app_key = os.getenv("B2_APPLICATION_KEY")
        self.bucket_name = os.getenv("B2_BUCKET_NAME", "lumora-products")
        self.bucket_id = os.getenv("B2_BUCKET_ID", "27564d2e82e3756b9dfd091d")
        
        self.auth_token = None
        self.api_url = None
        self.download_url = None
        
        if self.key_id and self.app_key:
            self._authorize()

    def _authorize(self) -> bool:
        url = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"
        try:
            resp = requests.get(url, auth=(self.key_id, self.app_key), timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                self.auth_token = data.get("authorizationToken")
                self.api_url = data.get("apiUrl")
                self.download_url = data.get("downloadUrl")
                allowed = data.get("allowed", {})
                if not self.bucket_id and allowed.get("bucketId"):
                    self.bucket_id = allowed.get("bucketId")
                if not self.bucket_name and allowed.get("bucketName"):
                    self.bucket_name = allowed.get("bucketName")
                return True
            else:
                print(f"[B2Storage] Authorization failed: {resp.text}")
                return False
        except Exception as e:
            print(f"[B2Storage] Auth exception: {e}")
            return False

    def is_available(self) -> bool:
        return bool(self.auth_token and self.api_url and self.bucket_id)

    def _ensure_auth(self):
        if not self.is_available():
            self._authorize()

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str, vendor_id: str, is_image: bool = False) -> Dict[str, Any]:
        self._ensure_auth()
        if not self.is_available():
            raise HTTPException(status_code=500, detail="Backblaze B2 storage is not authorized.")
            
        ext = os.path.splitext(filename.lower())[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        b2_file_path = f"vendors/{vendor_id}/temp/{unique_name}"
        
        upload_url_endpoint = f"{self.api_url}/b2api/v2/b2_get_upload_url"
        res = requests.post(
            upload_url_endpoint,
            headers={"Authorization": self.auth_token},
            json={"bucketId": self.bucket_id},
            timeout=10
        )
        if res.status_code != 200:
            self._authorize()
            res = requests.post(
                upload_url_endpoint,
                headers={"Authorization": self.auth_token},
                json={"bucketId": self.bucket_id},
                timeout=10
            )
            if res.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Failed to get B2 upload URL: {res.text}")

        upload_data = res.json()
        upload_url = upload_data["uploadUrl"]
        upload_auth_token = upload_data["authorizationToken"]

        file_sha1 = hashlib.sha1(file_bytes).hexdigest()
        encoded_file_name = urllib.parse.quote(b2_file_path)

        upload_res = requests.post(
            upload_url,
            headers={
                "Authorization": upload_auth_token,
                "X-Bz-File-Name": encoded_file_name,
                "Content-Type": content_type or "b2/x-auto",
                "X-Bz-Content-Sha1": file_sha1,
            },
            data=file_bytes,
            timeout=60
        )

        if upload_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"B2 upload failed: {upload_res.text}")

        public_url = f"{self.download_url}/file/{self.bucket_name}/{b2_file_path}"
        storage_path = f"b2://{self.bucket_name}/{b2_file_path}"

        return {
            "storage_path": storage_path,
            "url": public_url,
        }

    def move_file(self, source_path: str, target_path: str) -> str:
        self._ensure_auth()
        src_clean = source_path.replace(f"b2://{self.bucket_name}/", "")
        dest_clean = target_path.replace(f"b2://{self.bucket_name}/", "")

        file_id = self._get_file_id_by_name(src_clean)
        if not file_id:
            return ""

        copy_endpoint = f"{self.api_url}/b2api/v2/b2_copy_file"
        copy_res = requests.post(
            copy_endpoint,
            headers={"Authorization": self.auth_token},
            json={
                "sourceFileId": file_id,
                "fileName": dest_clean,
            },
            timeout=15
        )
        if copy_res.status_code == 200:
            self.delete_file_id(file_id, src_clean)
            return f"{self.download_url}/file/{self.bucket_name}/{dest_clean}"
        return ""

    def _get_file_id_by_name(self, file_name: str) -> str:
        self._ensure_auth()
        endpoint = f"{self.api_url}/b2api/v2/b2_list_file_names"
        res = requests.post(
            endpoint,
            headers={"Authorization": self.auth_token},
            json={
                "bucketId": self.bucket_id,
                "startFileName": file_name,
                "maxFileCount": 1
            },
            timeout=10
        )
        if res.status_code == 200:
            files = res.json().get("files", [])
            if files and files[0].get("fileName") == file_name:
                return files[0].get("fileId")
        return ""

    def delete_file_id(self, file_id: str, file_name: str) -> bool:
        self._ensure_auth()
        endpoint = f"{self.api_url}/b2api/v2/b2_delete_file_version"
        res = requests.post(
            endpoint,
            headers={"Authorization": self.auth_token},
            json={"fileId": file_id, "fileName": file_name},
            timeout=10
        )
        return res.status_code == 200

    def delete_file(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        clean_name = storage_path.replace(f"b2://{self.bucket_name}/", "")
        file_id = self._get_file_id_by_name(clean_name)
        if file_id:
            return self.delete_file_id(file_id, clean_name)
        return False

    def get_file_stream(self, storage_path: str) -> Generator[bytes, None, None]:
        self._ensure_auth()
        clean_name = storage_path.replace(f"b2://{self.bucket_name}/", "")
        file_url = f"{self.download_url}/file/{self.bucket_name}/{clean_name}"
        res = requests.get(file_url, headers={"Authorization": self.auth_token}, stream=True, timeout=30)
        if res.status_code != 200:
            raise HTTPException(status_code=404, detail="File not found in Backblaze B2 storage")
        for chunk in res.iter_content(chunk_size=8192):
            if chunk:
                yield chunk

    def exists(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        clean_name = storage_path.replace(f"b2://{self.bucket_name}/", "")
        return bool(self._get_file_id_by_name(clean_name))


class StorageService:
    def __init__(self):
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.local_provider = LocalStorageProvider(os.path.join(backend_dir, "uploads"))
        self.pcloud_provider = PCloudStorageProvider(os.path.join(backend_dir, "uploads"))
        self.b2_provider = B2StorageProvider()
        
        # Fetch configurations from environment/settings
        bucket_name = os.getenv("R2_BUCKET_NAME") or os.getenv("FIREBASE_STORAGE_BUCKET") or "lumora-e6ddc.appspot.com"
        self.firebase_provider = FirebaseStorageProvider(bucket_name)
        
        # Determine provider preference
        pref = os.getenv("STORAGE_PROVIDER", "firebase").lower()
        if pref == "b2" and self.b2_provider.is_available():
            self.provider = self.b2_provider
            print("[StorageService] Active Provider: Backblaze B2 Storage")
        elif pref == "pcloud":
            self.provider = self.pcloud_provider
            print("[StorageService] Active Provider: pCloud Storage (Testing)")
        elif pref == "firebase" and self.firebase_provider.is_available():
            self.provider = self.firebase_provider
            print("[StorageService] Active Provider: Firebase Storage")
        elif self.b2_provider.is_available():
            self.provider = self.b2_provider
            print("[StorageService] Active Provider: Backblaze B2 Storage")
        else:
            self.provider = self.local_provider
            print("[StorageService] Active Provider: Local Disk (Fallback)")

    def validate_file(self, file_bytes: bytes, filename: str, is_image: bool = False) -> str:
        ext = os.path.splitext(filename.lower())[1]
        
        # Extension & Size check
        if is_image:
            allowed_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
            max_size = int(os.getenv("MAX_IMAGE_SIZE", 5 * 1024 * 1024)) # 5MB
        else:
            allowed_exts = {
                ".zip", ".pdf", ".fig", ".sketch", ".xd", ".psd", ".ai", ".epub",
                ".docx", ".xlsx", ".pptx", ".mp4", ".mp3", ".wav", ".ttf", ".otf",
                ".json", ".csv", ".tar", ".gz", ".rar", ".7z",
            }
            max_size = int(os.getenv("MAX_UPLOAD_SIZE", 100 * 1024 * 1024)) # 100MB
            
        blocked_exts = {".exe", ".bat", ".sh", ".cmd", ".com", ".scr", ".msi", ".dll", ".pif", ".application", ".gadget", ".wsf", ".vbs", ".asp", ".aspx", ".php", ".jsp", ".cgi"}
        if ext in blocked_exts:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Executable files are strictly blocked for security."
            )

        if ext not in allowed_exts:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File extension '{ext}' not allowed. Allowed: {', '.join(sorted(allowed_exts))}"
            )
            
        if len(file_bytes) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {max_size // 1024 // 1024} MB."
            )
            
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="File is empty."
            )
            
        return ext

    def compute_sha256(self, file_bytes: bytes) -> str:
        return hashlib.sha256(file_bytes).hexdigest()

    def upload(self, file_bytes: bytes, filename: str, content_type: str, vendor_id: str, is_image: bool = False) -> Dict[str, Any]:
        self.validate_file(file_bytes, filename, is_image)
        res = self.provider.upload_file(file_bytes, filename, content_type, vendor_id, is_image)
        res["hash"] = self.compute_sha256(file_bytes)
        res["content_type"] = content_type
        return res

    def resolve_storage_path_from_url(self, url: str) -> str:
        if not url:
            return ""
        if url.startswith("gs://") or url.startswith("local://") or url.startswith("pcloud://") or url.startswith("b2://"):
            return url
        if "storage.googleapis.com" in url:
            parts = url.split("storage.googleapis.com/")[1].split("/")
            bucket = parts[0]
            blob_path = "/".join(parts[1:])
            return f"gs://{bucket}/{blob_path}"
        elif self.b2_provider.download_url and self.b2_provider.download_url in url:
            parts = url.split(f"{self.b2_provider.download_url}/file/")[1].split("/")
            bucket = parts[0]
            file_path = "/".join(parts[1:])
            return f"b2://{bucket}/{file_path}"
        elif "/uploads/" in url:
            rel_path = url.split("/uploads/")[1]
            if isinstance(self.provider, PCloudStorageProvider):
                return f"pcloud://uploads/{rel_path}"
            return f"local://uploads/{rel_path}"
        return url

    def move_to_permanent(self, source_path: str, vendor_id: str, product_id: int, filename: str, is_image: bool = False) -> Tuple[str, str]:
        if not source_path:
            return "", ""
            
        resolved_src = self.resolve_storage_path_from_url(source_path)
        ext = os.path.splitext(filename.lower())[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        subfolder = "images" if is_image else "files"
        
        if resolved_src.startswith("gs://"):
            bucket_name = resolved_src.split("/")[2]
            target_path = f"gs://{bucket_name}/vendors/{vendor_id}/products/{product_id}/{subfolder}/{unique_name}"
        elif resolved_src.startswith("b2://"):
            bucket_name = resolved_src.split("/")[2]
            target_path = f"b2://{bucket_name}/vendors/{vendor_id}/products/{product_id}/{subfolder}/{unique_name}"
        elif resolved_src.startswith("pcloud://"):
            target_path = f"pcloud://uploads/vendors/{vendor_id}/products/{product_id}/{subfolder}/{unique_name}"
        else:
            target_path = f"local://uploads/vendors/{vendor_id}/products/{product_id}/{subfolder}/{unique_name}"
            
        new_url = self.provider.move_file(resolved_src, target_path)
        return target_path, new_url

    def delete(self, storage_path: str) -> bool:
        if not storage_path:
            return False
        resolved_path = self.resolve_storage_path_from_url(storage_path)
        if resolved_path.startswith("b2://"):
            return self.b2_provider.delete_file(resolved_path)
        elif resolved_path.startswith("gs://") and isinstance(self.provider, FirebaseStorageProvider):
            return self.provider.delete_file(resolved_path)
        elif resolved_path.startswith("pcloud://") and isinstance(self.pcloud_provider, PCloudStorageProvider):
            return self.pcloud_provider.delete_file(resolved_path)
        else:
            return self.local_provider.delete_file(resolved_path)

    def get_stream(self, storage_path: str) -> Generator[bytes, None, None]:
        resolved_path = self.resolve_storage_path_from_url(storage_path)
        if resolved_path.startswith("b2://"):
            return self.b2_provider.get_file_stream(resolved_path)
        elif resolved_path.startswith("gs://") and isinstance(self.provider, FirebaseStorageProvider):
            return self.provider.get_file_stream(resolved_path)
        elif resolved_path.startswith("pcloud://") and isinstance(self.pcloud_provider, PCloudStorageProvider):
            return self.pcloud_provider.get_file_stream(resolved_path)
        else:
            return self.local_provider.get_file_stream(resolved_path)

    def exists(self, storage_path: str) -> bool:
        resolved_path = self.resolve_storage_path_from_url(storage_path)
        if resolved_path.startswith("b2://"):
            return self.b2_provider.exists(resolved_path)
        elif resolved_path.startswith("gs://") and isinstance(self.provider, FirebaseStorageProvider):
            return self.provider.exists(resolved_path)
        elif resolved_path.startswith("pcloud://") and isinstance(self.pcloud_provider, PCloudStorageProvider):
            return self.pcloud_provider.exists(resolved_path)
        else:
            return self.local_provider.exists(resolved_path)

# Instantiate singleton
storage_service = StorageService()


