import { TestBed } from '@angular/core/testing';

import { ParticleEngine } from './particle-engine';

describe('ParticleEngine', () => {
  let service: ParticleEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ParticleEngine);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
