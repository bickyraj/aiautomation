import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticleUniverse } from './particle-universe';

describe('ParticleUniverse', () => {
  let component: ParticleUniverse;
  let fixture: ComponentFixture<ParticleUniverse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticleUniverse]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticleUniverse);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
