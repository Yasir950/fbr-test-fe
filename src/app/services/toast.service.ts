import { HotToastService, ToastOptions, ToastPosition } from '@ngneat/hot-toast';
import { Injectable } from '@angular/core';

@Injectable(
  { providedIn: 'root' }
)
export class ToastService {
  constructor(private toastService: HotToastService) {
  }


  showToast(type: 'notification' | 'error', message: string, duration: number = 6 * 1000, position: ToastPosition = 'top-right', textAlign = 'left') {
    const toastOptions: ToastOptions<any> = {
      duration: duration,
      style: {
        marginTop: '10px',
        background: type === 'notification' ? '#2ead60' : '#f7696d',
        color: '#fff',
        'text-align': textAlign
      },
      iconTheme: {
        primary: type === 'notification' ? '#2ead60' : '#f7696d',
        secondary: type === 'notification' ? '#FFF' : '#FFF'
      },
      position: position,
      autoClose: true
    };

    if (type === 'notification') {
      this.toastService.success(`<p class='font-size-14 font-monospace text-center mb-0 tonflow-green-color text-center'>${message}</p>`, toastOptions);
    } else {
      this.toastService.error(`<p class='font-size-14 font-monospace tonflow-red-color mb-0 text-center'>${message}</p>`, toastOptions);
    }
  }


}
