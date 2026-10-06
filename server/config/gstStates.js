// GST state/UT codes — printed with the Place of Supply ("Nagaland ( 13 )")
// and used to decide IGST (inter-state) vs CGST + SGST (intra-state).
const GST_STATE_CODES = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', Punjab: '03', Chandigarh: '04', Uttarakhand: '05',
  Haryana: '06', Delhi: '07', Rajasthan: '08', 'Uttar Pradesh': '09', Bihar: '10', Sikkim: '11',
  'Arunachal Pradesh': '12', Nagaland: '13', Manipur: '14', Mizoram: '15', Tripura: '16', Meghalaya: '17',
  Assam: '18', 'West Bengal': '19', Jharkhand: '20', Odisha: '21', Chhattisgarh: '22', 'Madhya Pradesh': '23',
  Gujarat: '24', 'Dadra and Nagar Haveli and Daman and Diu': '26', Maharashtra: '27', Karnataka: '29', Goa: '30',
  Lakshadweep: '31', Kerala: '32', 'Tamil Nadu': '33', Puducherry: '34', 'Andaman and Nicobar Islands': '35',
  Telangana: '36', 'Andhra Pradesh': '37', Ladakh: '38',
};

module.exports = { GST_STATE_CODES, GST_STATES: Object.keys(GST_STATE_CODES) };
