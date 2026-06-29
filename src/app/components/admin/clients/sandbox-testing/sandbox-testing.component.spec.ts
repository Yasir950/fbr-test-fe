import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SandboxTestingComponent } from './sandbox-testing.component';

describe('SandboxTestingComponent', () => {
  let component: SandboxTestingComponent;
  let fixture: ComponentFixture<SandboxTestingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SandboxTestingComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SandboxTestingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
