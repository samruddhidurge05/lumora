from typing import List, Optional
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliatePayout, ReferralLink, ReferralClick
from app.repositories.base import BaseRepository

class AffiliateRepository(BaseRepository[AffiliateProfile]):
    def __init__(self, db):
        super().__init__(AffiliateProfile, db)

    def get_by_user_id(self, user_id: int) -> Optional[AffiliateProfile]:
        return self.db.query(AffiliateProfile).filter(AffiliateProfile.user_id == user_id).first()

    def get_by_code(self, code: str) -> Optional[AffiliateProfile]:
        return self.db.query(AffiliateProfile).filter(AffiliateProfile.referral_code == code).first()


class AffiliateCommissionRepository(BaseRepository[AffiliateCommission]):
    def __init__(self, db):
        super().__init__(AffiliateCommission, db)

    def get_by_affiliate(self, affiliate_id: int) -> List[AffiliateCommission]:
        return (
            self.db.query(AffiliateCommission)
            .filter(AffiliateCommission.affiliate_id == affiliate_id)
            .order_by(AffiliateCommission.created_at.desc())
            .all()
        )


class AffiliatePayoutRepository(BaseRepository[AffiliatePayout]):
    def __init__(self, db):
        super().__init__(AffiliatePayout, db)

    def get_by_affiliate(self, affiliate_id: int) -> List[AffiliatePayout]:
        return (
            self.db.query(AffiliatePayout)
            .filter(AffiliatePayout.affiliate_id == affiliate_id)
            .order_by(AffiliatePayout.created_at.desc())
            .all()
        )


class ReferralLinkRepository(BaseRepository[ReferralLink]):
    def __init__(self, db):
        super().__init__(ReferralLink, db)

    def get_link(self, affiliate_id: int, product_id: int) -> Optional[ReferralLink]:
        return (
            self.db.query(ReferralLink)
            .filter(ReferralLink.affiliate_id == affiliate_id)
            .filter(ReferralLink.product_id == product_id)
            .first()
        )

    def get_by_code(self, code: str) -> Optional[ReferralLink]:
        return self.db.query(ReferralLink).filter(ReferralLink.referral_code == code).first()
