import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwaitingVerificationComponent } from './awaiting-verification.component';

describe('AwaitingVerificationComponent', () => {
  let component: AwaitingVerificationComponent;
  let fixture: ComponentFixture<AwaitingVerificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwaitingVerificationComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AwaitingVerificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
