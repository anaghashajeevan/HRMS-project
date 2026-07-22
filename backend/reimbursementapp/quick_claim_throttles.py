from rest_framework.throttling import UserRateThrottle


class QuickClaimUploadThrottle(UserRateThrottle):
    scope = "quick_claim_upload"

    def get_rate(self):
        from django.conf import settings

        return settings.QUICK_CLAIM_UPLOAD_RATE


class QuickClaimSendThrottle(UserRateThrottle):
    scope = "quick_claim_send"

    def get_rate(self):
        from django.conf import settings

        return settings.QUICK_CLAIM_SEND_RATE
