export interface ApiPicnicConnection {
  status: 'Disconnected' | 'VerificationRequired' | 'Connected' | 'ReconnectRequired';
  accountLabel: string | null;
  countryCode: 'NL' | 'DE' | 'FR';
}
