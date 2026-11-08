import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChipShowcase } from './chip-showcase';

describe('ChipShowcase', () => {
  let component: ChipShowcase;
  let fixture: ComponentFixture<ChipShowcase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChipShowcase]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChipShowcase);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
