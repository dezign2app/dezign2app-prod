import { AuthNodeData } from "./generateAuthConfig";

/**
 * Generates `auth_middleware.py` for FastAPI services to verify tokens against Better Auth server via JWKS or session API
 */
export function generateFastApiMiddleware(_data: AuthNodeData): string {
  return `import os
import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

security = HTTPBearer()

BETTER_AUTH_URL = os.getenv("BETTER_AUTH_URL", "http://localhost:3000")
JWKS_URL = os.getenv("JWKS_URL", f"{BETTER_AUTH_URL}/api/auth/jwks")

_jwks_client = None

def get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        try:
            _jwks_client = jwt.PyJWKClient(JWKS_URL)
        except Exception:
            _jwks_client = None
    return _jwks_client

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates Bearer token statelessly via JWKS public key endpoint (/api/auth/jwks),
    falling back to /api/auth/get-session if needed.
    """
    token = credentials.credentials
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Stateless JWKS Verification (Recommended for disconnected microservices)
    jwks_client = get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "EdDSA", "ES256"],
                options={"verify_aud": False}
            )
            if payload and (payload.get("sub") or payload.get("id") or payload.get("user_id")):
                return payload
        except Exception:
            pass

    # 2. Fallback to /api/auth/get-session verification
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{BETTER_AUTH_URL}/api/auth/get-session",
                headers=headers,
                timeout=5.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            data = response.json()
            if not data or "user" not in data or not data["user"] or not data["user"].get("id"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User record not found",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return data["user"]
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Authentication service unavailable: {str(exc)}",
            )
`;
}
