import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalManagersComponent } from './portal-managers.component';

describe('PortalManagersComponent', () => {
  let component: PortalManagersComponent;
  let fixture: ComponentFixture<PortalManagersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PortalManagersComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PortalManagersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
