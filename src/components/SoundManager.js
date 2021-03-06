import SoundSource from 'app/components/SoundSource';
import OceanSound from 'app/components/OceanSound';
import { autorun, when } from 'mobx';
import uiState from 'app/uiState';
import { Volume, Analyser } from 'tone';

import oceans from 'app/data/oceans';

export default class SoundManager {
  constructor(map) {
    this.fftAnalyser = new Analyser('waveform', 32);
    this.fftAnalyser.toMaster();
    this.masterVol = new Volume(6);
    this.masterVol.connect(this.fftAnalyser);

    when(() => uiState.islands.length, this.initIslandSounds);
    this.initWaterSound();
    autorun(this.update);
  }

  initWaterSound = () => {
    this.oceanSound = new OceanSound();
    this.oceanSound.load(() => {
      uiState.removePendingRequest('ocean');
      this.oceanSound.start();
    });

    uiState.addPendingRequest('ocean');
    this.oceanSound.connect(this.masterVol);
  };

  initIslandSounds = () => {
    this.islandSounds = uiState.islands.map(island => {
      const islandSound = new SoundSource(island);

      islandSound.load(() => {
        uiState.removePendingRequest(island.id);
        // Make sure buddy islands start at the same time
        if (island.buddy) {
          const buddyIsland = this.islandSounds.filter(
            i => i.id === island.buddy,
          )[0];
          if (buddyIsland.loaded) {
            islandSound.start();
            buddyIsland.start();
          }
        } else {
          islandSound.start();
        }
      });

      uiState.addPendingRequest(island.id);
      islandSound.connect(this.masterVol);
      return islandSound;
    });
  };

  update = () => {
    const { islands, muted, envParams, readyToPlay, updateSounds } = uiState;
    // abort if islands not loaded or islandSounds not initialized or if sounds
    // explicitly should not be updated to prevent transition blips
    if (!islands.length || !this.islandSounds || !updateSounds) return;

    this.masterVol.mute = !readyToPlay || muted;
    islands.forEach(({ id, pan, volume, volNormal, play }) => {
      const source = this.islandSounds.filter(i => i.id === id)[0];
      source.update(volume, pan, volNormal, play);
    });

    this.oceanSound.update(envParams.volume, envParams.latNormal);
  };

  getFFT = () => {
    return this.fftAnalyser.getValue();
  };
}
