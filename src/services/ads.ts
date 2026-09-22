export type AdPlacement = 'palette_open' | 'photo_check_bonus'

export interface AdService {
  showInterstitial(placement: AdPlacement): Promise<void>
  showRewarded(placement: AdPlacement): Promise<boolean>
}

export class NoOpAdService implements AdService {
  async showInterstitial(_placement: AdPlacement) { return Promise.resolve() }
  async showRewarded(_placement: AdPlacement) { return Promise.resolve(false) }
}

export const adService: AdService = new NoOpAdService()
