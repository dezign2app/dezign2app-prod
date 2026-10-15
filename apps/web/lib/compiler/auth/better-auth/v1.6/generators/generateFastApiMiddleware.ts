import { BetterAuthV16NodeData } from "../types";

/**
 * Generates `auth_middleware.py` for FastAPI services to verify tokens against Better Auth server
 */
export function generateFastApiMiddleware(data: BetterAuthV16NodeData): string {
  return `import os
import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

security = HTTPBearer()

BETTER_AUTH_URL = os.getenv("BETTER_AUTH_URL", "http://localhost:3001")
BETTER_AUTH_SECRET = os.getenv("BETTER_AUTH_SECRET", "default_super_secret_key_change_in_production")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates Bearer token statelessly via HS256 JWT signature using BETTER_AUTH_SECRET,
    falling back to Better Auth server /api/auth/get-session endpoint.
    Returns the user dict or raises 401 Unauthorized.
    """
    token = credentials.credentials
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Stateless HS256 JWT Verification (Instant for Postman & external test tokens)
    try:
        payload = jwt.decode(
            token,
            BETTER_AUTH_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        if payload and (payload.get("sub") or payload.get("id") or payload.get("userId") or payload.get("user_id")):
            user_id = payload.get("sub") or payload.get("id") or payload.get("userId") or payload.get("user_id")
            return {
                "id": user_id,
                "email": payload.get("email", f"{user_id}@example.com"),
                "name": payload.get("name", "Test User"),
                "role": payload.get("role", "user"),
                **payload
            }
    except Exception:
        pass

    # 2. Session verification via Better Auth /api/auth/get-session
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
                    detail="User record not found in database",
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

