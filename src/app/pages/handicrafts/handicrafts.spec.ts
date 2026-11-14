import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Handicrafts } from './handicrafts';

describe('Handicrafts', () => {
  let component: Handicrafts;
  let fixture: ComponentFixture<Handicrafts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Handicrafts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Handicrafts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
