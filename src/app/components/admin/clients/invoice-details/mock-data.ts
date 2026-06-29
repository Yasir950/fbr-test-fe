export const invoiceMockData = {
  id: '123456679923403',
  status: 'submitted',
  created_at: '2025-01-23T12:34:25.011Z',
  updated_at: '2025-01-23T12:54:25.011Z',
  client_id: 'xxcsdfsdfsdfsdf',
  submitter: { 'id': 'xxxx', name: 'Hamza Zia', cell_no_1: '0313-5197716', 'cell_no_2': '0335-2352234' },
  history: [{ status: 'initial_review', 'timestamp': '2025-01-23T12:54:25.011Z', user: { 'id': 'xxxx', name: 'Hamza Zia', cell_no_1: '0313-5197716', 'cell_no_2': '0335-2352234', type: 'client', comments: 'Submitted for initial review' } }, {
    status: 'rejected',
    'timestamp': '2025-01-23T13:54:25.011Z',
    user: { 'id': 'yyyy', name: 'Abbas Ahmed', cell_no_1: '0315-2197716', 'cell_no_2': '0333-3332234', type: 'admin', comments: 'Invoice rejected because of wrong HS number' }
  }, { status: 'initial_review', 'timestamp': '2025-01-24T12:54:25.011Z', user: { 'id': 'xxxx', name: 'Hamza Zia', cell_no_1: '0313-5197716', 'cell_no_2': '0335-2352234', type: 'client', comments: 'SN number fixed for the invoice' } },

    {
      status: 'final_review',
      'timestamp': '2025-01-23T15:54:25.011Z',
      user: { 'id': 'yyyy', name: 'Abbas Ahmed', cell_no_1: '0315-2197716', 'cell_no_2': '0333-3332234', type: 'admin', comments: 'Invoice looks ok. Submitted for final review.' }
    },
    {
      status: 'submitted',
      'timestamp': '2025-01-24T13:54:25.011Z',
      user: { 'id': 'yyyy', name: 'Rizwan Ahmed', cell_no_1: '0315-2197716', 'cell_no_2': '0333-3332234', type: 'admin', comments: 'Submitted to FBR.' }
    }

  ],
  invoice_data: {
    'invoice_id': 'xxxxxxxxxxxxxxxxxxxxxx',
    'invoiceType': 'Sale Invoice',
    'invoiceDate': '2025-06-30',
    'sellerNTNCNIC': '1234567',
    'sellerBusinessName': 'Company',
    'sellerProvince': 'CAPITAL TERRITORY',
    'sellerAddress': 'This is the sellers address',
    'buyerNTNCNIC': '9999999999999',
    'buyerBusinessName': 'Internal',
    'buyerProvince': 'CAPITAL TERRITORY',
    'buyerAddress': 'This is the buyers address',
    'buyerRegistrationType': 'Unregistered',
    'invoiceRefNo': '',
    'scenarioId': 'SN018',
    'items': [
      {
        'hsCode': '2202.1090',
        'productDescription': 'Misc',
        'rate': '16%',
        'uoM': 'Others',
        'quantity': 1,
        'totalValues': 0,
        'valueSalesExcludingST': 100,
        'fixedNotifiedValueOrRetailPrice': 0,
        'salesTaxApplicable': 16,
        'salesTaxWithheldAtSource': 0,
        'extraTax': '',
        'furtherTax': 0,
        'sroScheduleNo': '',
        'fedPayable': 0,
        'discount': 0,
        'saleType': 'Services (FED in ST Mode)',
        'sroItemSerialNo': ''
      }
    ]
  }
};
