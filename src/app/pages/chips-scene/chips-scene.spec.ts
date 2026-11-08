import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChipsScene } from './chips-scene';

describe('ChipsScene', () => {
  let component: ChipsScene;
  let fixture: ComponentFixture<ChipsScene>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChipsScene]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChipsScene);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
