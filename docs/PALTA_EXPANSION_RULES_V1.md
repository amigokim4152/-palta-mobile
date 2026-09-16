# Palta Expansion Rules v1

Every new subsystem should satisfy these rules before implementation:

1. **Canonical first**
   - Palta identities are independent of providers.

2. **Provider adapter boundary**
   - external services are replaceable.

3. **State machine before UI**
   - define durable business state, then render it.

4. **Event history**
   - meaningful transitions must be reconstructable for analytics/audit.

5. **No vertical duplication**
   - shared commerce/payment/care/location capabilities stay shared.

6. **Progressive capability**
   - start simple, but the model must tolerate more providers, payment rails and roles.

7. **Cost isolation**
   - expensive provider calls are isolated, observable and cacheable where appropriate.

8. **Security boundary**
   - secrets and privileged credentials never live in mobile clients.

9. **Regulated capability isolation**
   - regulated payment custody/settlement is not mixed into general commerce code.

10. **Backward-compatible extension**
   - new capabilities should extend contracts without changing canonical IDs or rewriting historical records.
