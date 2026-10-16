# api-gateway

The single endpoint through which the company's applications reach the notifications, file-storage and audit-logs services. It identifies who is calling, applies shared limits, and hands the request on. It does not authenticate people: that belongs to the authentication portal.

## Language

**Caller**:
Anything that presents a gateway credential to use the gateway: an application (CRMS, POS, IMS, HRMS, ECOM, the Portal) or one of the services behind it (Authentication, file storage, notifications). A service can be both a Caller and a destination. The gateway checks only which Caller is knocking, never which person is behind the request. It maps each Caller to the identity the downstream service expects (a Source, a Client System, or an App).
_Avoid_: App (notifications term), Client System (file-storage term), Source (audit-logs term), System (authentication portal term), Consumer
