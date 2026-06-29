import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientInvoicesComponent } from './client-invoices.component';

describe('ClientInvoicesComponent', () => {
  let component: ClientInvoicesComponent;
  let fixture: ComponentFixture<ClientInvoicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientInvoicesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientInvoicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
