import { TestBed } from '@angular/core/testing';

import { ParticleColorGenerator } from './particle-color-generator';

describe('ParticleColorGenerator', () => {
  let service: ParticleColorGenerator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ParticleColorGenerator);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
