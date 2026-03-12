import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

export class SimpleOAuthProvider implements OAuthServerProvider {
  private readonly _clients = new Map<string, OAuthClientInformationFull>();
  private readonly _codes = new Map<string, { challenge: string; clientId: string }>();
  private readonly _tokens = new Map<string, AuthInfo>();

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (id: string) => Promise.resolve(this._clients.get(id)),
      registerClient: (client: OAuthClientInformationFull) => {
        const full: OAuthClientInformationFull = {
          ...client,
          client_id: randomUUID(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        this._clients.set(full.client_id, full);
        return Promise.resolve(full);
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const code = randomUUID();
    this._codes.set(code, { challenge: params.codeChallenge, clientId: client.client_id });
    const url = new URL(params.redirectUri);
    url.searchParams.set('code', code);
    if (params.state) url.searchParams.set('state', params.state);
    res.redirect(url.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    code: string,
  ): Promise<string> {
    const data = this._codes.get(code);
    if (!data) throw new Error('Invalid authorization code');
    return data.challenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
  ): Promise<OAuthTokens> {
    const data = this._codes.get(code);
    if (!data) throw new Error('Invalid authorization code');
    this._codes.delete(code);
    const token = randomUUID();
    this._tokens.set(token, {
      token,
      clientId: client.client_id,
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400,
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new Error('Refresh tokens not supported');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const info = this._tokens.get(token);
    if (!info) throw new Error('Invalid token');
    if (info.expiresAt && info.expiresAt < Math.floor(Date.now() / 1000)) {
      this._tokens.delete(token);
      throw new Error('Token expired');
    }
    return info;
  }
}
