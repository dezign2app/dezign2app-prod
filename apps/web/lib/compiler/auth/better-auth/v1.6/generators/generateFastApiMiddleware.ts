import { BetterAuthV16NodeData } from "../types";

/**
 * Generates `auth_middleware.py` for FastAPI services to verify tokens against Better Auth server
 */
export function generateFastApiMiddleware(data: BetterAuthV16NodeData): string {
  return `import os
import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()

BETTER_AUTH_URL = os.getenv("BETTER_AUTH_URL", "http://localhost:3001")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates Bearer token or session cookie against Better Auth server endpoints.
    Returns the user dict or raises 401 Unauthorized.
    """
    token = credentials.credentials
    headers = {"Authorization": f"Bearer {token}"}
    
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
            if not data or "user" not in data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session not found",
                )
            return data["user"]
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Authentication service unavailable: {str(exc)}",
            )
`;
}
