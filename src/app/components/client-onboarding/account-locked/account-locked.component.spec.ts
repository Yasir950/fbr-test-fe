import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountLockedComponent } from './account-locked.component';

describe('AccountLockedComponent', () => {
  let component: AccountLockedComponent;
  let fixture: ComponentFixture<AccountLockedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AccountLockedComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountLockedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
