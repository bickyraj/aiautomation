import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmoothieShowcase } from './smoothie-showcase';

describe('SmoothieShowcase', () => {
  let component: SmoothieShowcase;
  let fixture: ComponentFixture<SmoothieShowcase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmoothieShowcase]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SmoothieShowcase);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
