import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChargeClientComponent } from './charge-client.component';

describe('ChargeClientComponent', () => {
  let component: ChargeClientComponent;
  let fixture: ComponentFixture<ChargeClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChargeClientComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChargeClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
