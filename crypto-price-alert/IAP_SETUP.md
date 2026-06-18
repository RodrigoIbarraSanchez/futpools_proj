# In-App Purchase (Recarga) – Configuración

## Product IDs (deben coincidir con el backend y App Store Connect)

- `com.futpools.recharge.50` → 50 de saldo
- `com.futpools.recharge.100` → 100 de saldo
- `com.futpools.recharge.200` → 200 de saldo
- `com.futpools.recharge.500` → 500 de saldo

## Xcode

1. **Capability**: En el target de la app, añade **In-App Purchase** (Signing & Capabilities → + Capability).
2. **StoreKit Configuration (pruebas locales)**:
   - File → New → File → StoreKit Configuration File.
   - Añade 4 **Consumable** in-app purchases con los product IDs de arriba.
   - En el scheme de la app: Run → Options → StoreKit Configuration → selecciona tu archivo `.storekit`.
3. **App Store Connect (producción)**:
   - Crea los mismos 4 productos como **Consumable** en App Store Connect (tu app → Features → In-App Purchases).
   - Referencia, nombre y descripción en el idioma que quieras.

## Backend

El endpoint `POST /users/me/balance/recharge` espera el body:

```json
{ "signedTransaction": "<JWS from StoreKit 2 Transaction.jwsRepresentation>" }
```

El backend decodifica el JWS, comprueba que el `productId` sea uno de los anteriores, aplica idempotencia por `originalTransactionId` y suma el saldo al usuario.
