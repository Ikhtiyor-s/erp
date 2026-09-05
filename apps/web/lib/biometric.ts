import { api } from "@/lib/api";

export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.PublicKeyCredential;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function _b64urlToBuffer(b64url: string): ArrayBuffer {
  const padding = 4 - (b64url.length % 4);
  const padded = padding !== 4 ? b64url + "=".repeat(padding) : b64url;
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function _bufferToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function _detectDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Desktop";
}

export async function enrollBiometric(): Promise<boolean> {
  try {
    const beginResp = await api.post<{
      challenge: string;
      rp: { name: string; id: string };
      user: { id: string; name: string; displayName: string };
      pubKeyCredParams: { type: string; alg: number }[];
      timeout: number;
      attestation: string;
      authenticatorSelection: Record<string, string>;
    }>("/auth/webauthn/register/begin");

    const opts = beginResp.data;
    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: _b64urlToBuffer(opts.challenge),
      rp: opts.rp,
      user: {
        id: _b64urlToBuffer(opts.user.id),
        name: opts.user.name,
        displayName: opts.user.displayName,
      },
      pubKeyCredParams: opts.pubKeyCredParams as PublicKeyCredentialParameters[],
      timeout: opts.timeout,
      attestation: opts.attestation as AttestationConveyancePreference,
      authenticatorSelection: opts.authenticatorSelection as AuthenticatorSelectionCriteria,
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) return false;

    const pkCred = credential as PublicKeyCredential;
    const response = pkCred.response as AuthenticatorAttestationResponse;

    await api.post("/auth/webauthn/register/finish", {
      credential_id: _bufferToB64url(pkCred.rawId),
      client_data_json: _bufferToB64url(response.clientDataJSON),
      attestation_object: _bufferToB64url(response.attestationObject),
      device_name: _detectDeviceName(),
    });

    localStorage.setItem("biometric_enrolled", "1");
    return true;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometric(email: string): Promise<boolean> {
  try {
    const beginResp = await api.post<{
      challenge: string;
      timeout: number;
      rpId: string;
      allowCredentials: { type: string; id: string; transports: string[] }[];
      userVerification: string;
    }>("/auth/webauthn/login/begin", { email });

    const opts = beginResp.data;
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: _b64urlToBuffer(opts.challenge),
      timeout: opts.timeout,
      rpId: opts.rpId,
      allowCredentials: opts.allowCredentials.map((c) => ({
        type: c.type as PublicKeyCredentialType,
        id: _b64urlToBuffer(c.id),
        transports: c.transports as AuthenticatorTransport[],
      })),
      userVerification: opts.userVerification as UserVerificationRequirement,
    };

    const assertion = await navigator.credentials.get({ publicKey });
    if (!assertion) return false;

    const pkAssertion = assertion as PublicKeyCredential;
    const assertionResponse = pkAssertion.response as AuthenticatorAssertionResponse;

    const finishResp = await api.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>("/auth/webauthn/login/finish", {
      email,
      credential_id: _bufferToB64url(pkAssertion.rawId),
      client_data_json: _bufferToB64url(assertionResponse.clientDataJSON),
      authenticator_data: _bufferToB64url(assertionResponse.authenticatorData),
      signature: _bufferToB64url(assertionResponse.signature),
      user_handle: assertionResponse.userHandle
        ? _bufferToB64url(assertionResponse.userHandle)
        : null,
    });

    const { access_token, refresh_token } = finishResp.data;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);

    try {
      const orgsResp = await api.get<{ id: string }[]>("/organizations/mine");
      if (Array.isArray(orgsResp.data) && orgsResp.data.length > 0) {
        if (!localStorage.getItem("org_id")) {
          localStorage.setItem("org_id", orgsResp.data[0].id);
        }
      }
    } catch {
      // org_id will be set on next page load via normal auth flow
    }

    return true;
  } catch {
    return false;
  }
}
