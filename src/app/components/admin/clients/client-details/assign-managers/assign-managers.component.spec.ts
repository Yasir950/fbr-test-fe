import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignManagersComponent } from './assign-managers.component';

describe('AssignManagersComponent', () => {
  let component: AssignManagersComponent;
  let fixture: ComponentFixture<AssignManagersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AssignManagersComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignManagersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
