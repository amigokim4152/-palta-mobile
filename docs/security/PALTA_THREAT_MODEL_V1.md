# Palta Threat Model v1

Primary threats:

1. Account takeover
2. Staff privilege abuse
3. Cross-business/tenant data leak
4. Personal Home leakage
5. Exact-location overcollection
6. Payment credential leakage
7. Webhook spoof/replay
8. Duplicate payment/order state transitions
9. QR/order abuse
10. Refund/discount abuse
11. API scraping and bulk export
12. Provider credential theft
13. Malicious or compromised mobile client
14. Backup/restore failure
15. Insider access to confidential analytics
16. Infrastructure/vendor outage

Design stance:
- deny by default
- least privilege
- minimize retained sensitive data
- canonical IDs independent of providers
- append meaningful audit history
- separate privileged control plane from consumer UI
- assume mobile client can be inspected/tampered with
