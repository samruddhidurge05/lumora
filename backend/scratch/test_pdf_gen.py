def generate_fallback_pdf(title: str, product_id: int) -> bytes:
    clean_title = str(title).encode("latin-1", "replace").decode("latin-1")
    pdf_content = (
        "%PDF-1.4\n"
        "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        "2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        "3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n"
        "4 0 obj <</Length 250>> stream\n"
        "BT /F1 24 Tf 50 700 Td (Lumora Digital Product) Tj ET\n"
        f"BT /F1 16 Tf 50 650 Td (Product ID: {product_id}) Tj ET\n"
        f"BT /F1 14 Tf 50 620 Td (Title: {clean_title}) Tj ET\n"
        "BT /F1 12 Tf 50 580 Td (Thank you for your purchase on Lumora Marketplace.) Tj ET\n"
        "BT /F1 10 Tf 50 540 Td (License: Personal and Commercial License Granted.) Tj ET\n"
        "endstream\n"
        "endobj\n"
        "5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        "xref\n"
        "0 6\n"
        "0000000000 65535 f \n"
        "0000000009 00000 n \n"
        "0000000058 00000 n \n"
        "0000000115 00000 n \n"
        "0000000244 00000 n \n"
        "0000000495 00000 n \n"
        "trailer <</Size 6 /Root 1 0 R>>\n"
        "startxref\n"
        "568\n"
        "%%EOF\n"
    )
    return pdf_content.encode("latin-1")

if __name__ == "__main__":
    pdf_bytes = generate_fallback_pdf("PDF Handbook Guide", 189)
    print("PDF bytes length:", len(pdf_bytes))
    print("Starts with %PDF:", pdf_bytes.startswith(b"%PDF"))
