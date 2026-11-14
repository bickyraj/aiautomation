import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Jewels } from './jewels';

describe('Jewels', () => {
  let component: Jewels;
  let fixture: ComponentFixture<Jewels>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Jewels]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Jewels);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
