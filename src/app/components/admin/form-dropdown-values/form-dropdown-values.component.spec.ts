import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormDropdownValuesComponent } from './form-dropdown-values.component';

describe('FormDropdownValuesComponent', () => {
  let component: FormDropdownValuesComponent;
  let fixture: ComponentFixture<FormDropdownValuesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FormDropdownValuesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormDropdownValuesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
