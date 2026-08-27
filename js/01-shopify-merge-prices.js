/* Healthspan boxed-H mark — the exact brand logo (logo-h.png, transparent bg) */
function hsLogo(sz,color){
  return '<img src="/logo-h.png" alt="Healthspan" style="width:'+sz+'px;height:'+sz+'px;display:block;object-fit:contain">';
}


const SEED = [{"sku":"ME0102","name":"01 ETHNIC SKIN 20G","line":"Meline","category":"Commercial","received":889,"sold":790,"stock":0,"price":4464.29,"batch":"S042","expiry":"10/2024","bin":"IB03","size":"5.7 x 5 x 15.8","velocity":0,"monthsOfStock":null},{"sku":"ME0114","name":"01 ETHNIC SKIN 15G","line":"Meline","category":"Commercial","received":454,"sold":392,"stock":45,"price":45.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ME0109","name":"01 MOIST PROFESSIONAL","line":"Meline","category":"Commercial","received":443,"sold":371,"stock":28,"price":8660.71,"batch":"P1, T01","expiry":"11-2024 / 03-2027","bin":"IA02","size":"5.5 x 5.5 x 6.5","velocity":0,"monthsOfStock":null},{"sku":"ME0110","name":"01 RESTORE PROFESSIONAL","line":"Meline","category":"Commercial","received":456,"sold":408,"stock":3,"price":8660.71,"batch":"P1, T01","expiry":"11-2024 / 04-2027","bin":"IB02","size":"5.5 x 5.5 x 6.5","velocity":0,"monthsOfStock":null},{"sku":"ME000F","name":"F GENTLE FOAM","line":"Meline","category":"Commercial","received":1735,"sold":1563,"stock":103,"price":1607.14,"batch":"S01","expiry":"12/2026","bin":"GB02","size":"4.5 x 4.5 x 18","velocity":0,"monthsOfStock":null},{"sku":"ME0202","name":"02 ETHNIC SKIN DAY","line":"Meline","category":"Commercial","received":2501,"sold":2383,"stock":62,"price":3303.57,"batch":"T04","expiry":"4/2025","bin":"HB03","size":"2 x 2 x 5","velocity":0,"monthsOfStock":null},{"sku":"ME0205","name":"02 ETHNIC SKIN NIGHT 20G","line":"Meline","category":"Commercial","received":1480,"sold":1423,"stock":0,"price":3303.57,"batch":"T04","expiry":"10/2025","bin":"HB04","size":"5.7 x 5 x 15.8","velocity":0,"monthsOfStock":null},{"sku":"ME0211","name":"02 ETHNIC SKIN NIGHT 30G","line":"Meline","category":"Commercial","received":1328,"sold":1264,"stock":53,"price":null,"batch":"-","expiry":"-","bin":"-","size":"38 x 38 x 32","velocity":0,"monthsOfStock":null},{"sku":"ME0301","name":"03 MOIST","line":"Meline","category":"Commercial","received":1979,"sold":1853,"stock":76,"price":2142.86,"batch":"T01","expiry":"4/2027","bin":"HA02","size":"5.7 x 5 x 15.8","velocity":0,"monthsOfStock":null},{"sku":"ME0302","name":"03 RESTORE","line":"Meline","category":"Commercial","received":3467,"sold":3190,"stock":171,"price":1964.29,"batch":"S03","expiry":"4/2027","bin":"HA03","size":"8 x 8 x 5.5","velocity":0,"monthsOfStock":null},{"sku":"ME0501","name":"05 PIGMENT HOME MASK","line":"Meline","category":"Commercial","received":235,"sold":43,"stock":0,"price":null,"batch":"S03","expiry":"6/2026","bin":"CB01","size":"8 x 8 x 5.5","velocity":0,"monthsOfStock":null},{"sku":"ME0001MU","name":"00 MELINEPREP SAMPLE","line":"Meline","category":"MKT SAMPLES","received":482,"sold":12,"stock":0,"price":null,"batch":"T05","expiry":"5/2025","bin":"CB02","size":"3.5 x 2 x 8","velocity":0,"monthsOfStock":null},{"sku":"ME0102MU","name":"01 ETHNIC SKIN SAMPLE","line":"Meline","category":"MKT SAMPLES","received":689,"sold":0,"stock":0,"price":null,"batch":"T01","expiry":"3/2025","bin":"CB02","size":"-","velocity":0,"monthsOfStock":null},{"sku":"ME0202MU","name":"02 ETHNIC SKIN SKIN DAY SAMPLE","line":"Meline","category":"MKT SAMPLES","received":1262,"sold":3,"stock":0,"price":null,"batch":"P1","expiry":"-","bin":"CB04","size":"-","velocity":0,"monthsOfStock":null},{"sku":"ME0205MU","name":"02 ETHNIC SKIN SKIN NIGHT SAMPLE","line":"Meline","category":"MKT SAMPLES","received":1523,"sold":0,"stock":0,"price":null,"batch":"R1","expiry":"-","bin":"CB04","size":"-","velocity":0,"monthsOfStock":null},{"sku":"MKT632","name":"MELINE HEAD BAND","line":"Meline","category":"MKT SAMPLES","received":83,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"-","bin":"BB03","size":"-","velocity":0,"monthsOfStock":null},{"sku":"ID021","name":"SUN DEFENSE SPF 50+","line":"Inno Derma","category":"Commercial","received":2101,"sold":1847,"stock":0,"price":4419.64,"batch":"T02","expiry":"5/2025","bin":"DA02","size":"4 x 4 x 15","velocity":0,"monthsOfStock":null},{"sku":"ID022","name":"SUN DEFENSE SPF 50+ OILY SKIN","line":"Inno Derma","category":"Commercial","received":13583,"sold":11125,"stock":2052,"price":4419.64,"batch":"T02","expiry":"6/2025","bin":"DA03","size":"4 x 4 x 15","velocity":0,"monthsOfStock":null},{"sku":"ID020","name":"AKN DAY GEL","line":"Inno Derma","category":"MKT SAMPLES","received":2,"sold":0,"stock":0,"price":null,"batch":"S01","expiry":"-","bin":"EB02","size":"6.5 x 6.5 x 5.5","velocity":0,"monthsOfStock":null},{"sku":"TD040","name":"FACE NADE","line":"Inno TDS","category":"Commercial","received":15469,"sold":12971,"stock":2209,"price":5892.86,"batch":"T11","expiry":"9/2025 / 10/2025","bin":"EB04","size":"16.5 x 2.5 x 7","velocity":0,"monthsOfStock":null},{"sku":"TD057","name":"FIRMING","line":"Inno TDS","category":"Commercial","received":3249,"sold":2660,"stock":319,"price":5892.86,"batch":"S18, T07","expiry":"12-2024 / 08-2025","bin":"EB03","size":"16.5 x 2.5 x 7","velocity":0,"monthsOfStock":null},{"sku":"ID009","name":"AGE RESCUE 24H CREAM","line":"Inno Derma","category":"Commercial","received":920,"sold":738,"stock":88,"price":2544.64,"batch":"S02","expiry":"3/2026","bin":"FB03","size":"4.3 x 3.3 x 18.3","velocity":0,"monthsOfStock":null},{"sku":"ID010","name":"AKN \u03b2PURIFIER NIGHT GEL","line":"Inno Derma","category":"Commercial","received":654,"sold":484,"stock":89,"price":2544.64,"batch":"S03","expiry":"7/2026","bin":"EA03","size":"4.3 x 3.3 x 18.3","velocity":0,"monthsOfStock":null},{"sku":"ID011","name":"DARK SPOT ERASER DSE+ 24H CREAM","line":"Inno Derma","category":"Commercial","received":1271,"sold":1137,"stock":-6,"price":2812.5,"batch":"T02","expiry":"2/2025","bin":"EA02","size":"4.3 x 3.3 x 18.3","velocity":0,"monthsOfStock":null},{"sku":"ID002","name":"DEEP CLEANSER","line":"Inno Derma","category":"Commercial","received":1020,"sold":733,"stock":153,"price":1517.86,"batch":"S042, S051","expiry":"06-2026 / 09-2026","bin":"GA03","size":"5.5 x 5.5 x 21.2","velocity":0,"monthsOfStock":null},{"sku":"ID005","name":"EYE REVITALIZER","line":"Inno Derma","category":"Commercial","received":1130,"sold":980,"stock":9,"price":2187.5,"batch":"T01","expiry":"1/2027","bin":"GB03","size":"6.5 x 6.5 x 5.5","velocity":0,"monthsOfStock":null},{"sku":"ID013","name":"KERATODERM","line":"Inno Derma","category":"Commercial","received":295,"sold":204,"stock":56,"price":1919.64,"batch":"S01","expiry":"01-2026","bin":"56","size":"5.7 x 5.7 x 21.5","velocity":0,"monthsOfStock":null},{"sku":"ID016","name":"SENSITIVE CREAM","line":"Inno Derma","category":"Commercial","received":5325,"sold":5014,"stock":146,"price":1964.29,"batch":"S03","expiry":"7/2026","bin":"FB02","size":"6.5 x 6.5 x 5.5","velocity":0,"monthsOfStock":null},{"sku":"ID021MU","name":"SUN DEFENSE SPF 50+ - SAMPLE","line":"Inno Derma","category":"MKT SAMPLES","received":5351,"sold":0,"stock":85,"price":null,"batch":"T02","expiry":"9/2025","bin":"85","size":"DA02","velocity":0,"monthsOfStock":null},{"sku":"ID022MU","name":"SUN DEFENSE SPF 50+ OILY SKIN - SAMPLE","line":"Inno Derma","category":"MKT SAMPLES","received":11122,"sold":0,"stock":4460,"price":null,"batch":"S01","expiry":"-","bin":"4460","size":"DA03","velocity":0,"monthsOfStock":null},{"sku":"ID009MU","name":"AGE RESCUE 24H CREAM - SAMPLE","line":"Inno Derma","category":"MKT SAMPLES","received":2304,"sold":0,"stock":78,"price":null,"batch":"T01","expiry":"5/2027","bin":"FB03","size":"2.5 x 2.5 x 7.5","velocity":0,"monthsOfStock":null},{"sku":"ID010MU","name":"AKN \u03b2PURIFIER 24H CREAM - SAMPLE","line":"Inno Derma","category":"MKT SAMPLES","received":2369,"sold":50,"stock":124,"price":null,"batch":"S02","expiry":"6/2026","bin":"CB03","size":"2.5 x 2.5 x 7.5","velocity":0,"monthsOfStock":null},{"sku":"ID011MU","name":"DARK SPOT ERASER DSE+ 24H CREAM - SAMPLE","line":"Inno Derma","category":"MKT SAMPLES","received":847,"sold":0,"stock":0,"price":2812.5,"batch":"S02","expiry":"-","bin":"0","size":"2.5 x 2.5 x 7.5","velocity":0,"monthsOfStock":null},{"sku":"TD004MU","name":"FIRMING SAMPLE","line":"Inno TDS","category":"MKT SAMPLES","received":900,"sold":0,"stock":0,"price":0.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD025MU","name":"MATRIX SAMPLE","line":"Inno TDS","category":"MKT SAMPLES","received":1176,"sold":0,"stock":0,"price":0.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT133","name":"INNO HEADBAND","line":"Inno Derma","category":"MKT SAMPLES","received":103,"sold":0,"stock":5,"price":null,"batch":"-","expiry":"-","bin":"5","size":"-","velocity":0,"monthsOfStock":null},{"sku":"MKT134","name":"INNO BRUSH","line":"Inno Derma","category":"MKT SAMPLES","received":405,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"-","bin":"0","size":"-","velocity":0,"monthsOfStock":null},{"sku":"ME0001","name":"00 MELINE PREP","line":"Meline","category":"Commercial","received":1533,"sold":1401,"stock":36,"price":2187.5,"batch":"T03","expiry":"3/2025","bin":"IA03","size":"9 x 2.8 x 11.5","velocity":0,"monthsOfStock":null},{"sku":"ME0107","name":"01 MELINE ID","line":"Meline","category":"Commercial","received":2520,"sold":2326,"stock":50,"price":5267.86,"batch":"T03","expiry":"1/2025","bin":"IA04","size":"9 x 2.8 x 11.5","velocity":0,"monthsOfStock":null},{"sku":"ID200","name":"HAIR CAPS","line":"Meline","category":"Remedy Exclusive","received":55,"sold":55,"stock":0,"price":1741.07,"batch":"S01","expiry":"-","bin":"0","size":"8.5 x 4 x 12","velocity":0,"monthsOfStock":null},{"sku":"MKT630","name":"MELINE TOWEL 90x150CM","line":"Meline","category":"MKT SAMPLES","received":18,"sold":0,"stock":12,"price":null,"batch":"-","expiry":"-","bin":"BB02","size":"-","velocity":0,"monthsOfStock":null},{"sku":"ID201","name":"CAPS REDUCER","line":"Inno Derma","category":"Remedy Exclusive","received":5,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"-","bin":"","size":"0","velocity":0,"monthsOfStock":null},{"sku":"IC001","name":"INNO-CE MESHA SCARS","line":"INNO-CE","category":"Remedy Exclusive","received":72,"sold":21,"stock":19,"price":null,"batch":"2/2024","expiry":"-","bin":"","size":"19","velocity":0,"monthsOfStock":null},{"sku":"ME0209","name":"02 DARK CIRCLES","line":"Meline","category":"Commercial","received":604,"sold":303,"stock":92,"price":null,"batch":"02-2024 / 03-2025","expiry":"5.7 x 5.3 x 15.7","bin":"","size":"92","velocity":0,"monthsOfStock":null},{"sku":"TD055","name":"TDS SLIMMING","line":"Inno TDS","category":"Commercial","received":7553,"sold":6001,"stock":1343,"price":null,"batch":"11/2025","expiry":"16.5 x 2.5 x 7","bin":"1343","size":"EA04","velocity":0,"monthsOfStock":null},{"sku":"MKT135","name":"INNO TOWEL","line":"Inno Mkt","category":"MKT SAMPLES","received":0,"sold":0,"stock":0,"price":null,"batch":"B43","expiry":"-","bin":"0","size":"-","velocity":0,"monthsOfStock":null},{"sku":"MKT130","name":"INNO TOWEL 100x150 CM","line":"Inno Mkt","category":"MKT SAMPLES","received":6,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"-","bin":"0","size":"-","velocity":0,"monthsOfStock":null},{"sku":"MKT131","name":"INNO TOWEL 50x100 CM","line":"Inno Mkt","category":"MKT SAMPLES","received":6,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"-","bin":"0","size":"-","velocity":0,"monthsOfStock":null},{"sku":"MKT110","name":"INNO BALLPEN","line":"Inno Mkt","category":"MKT SAMPLES","received":6,"sold":0,"stock":0,"price":null,"batch":"B43","expiry":"-","bin":"0","size":"-","velocity":0,"monthsOfStock":null},{"sku":"TD200","name":"HYALURONIDASE","line":"Inno TDS","category":"Remedy Exclusive","received":47,"sold":0,"stock":30,"price":null,"batch":"T09","expiry":"5/2025","bin":"30","size":"16.5 x 2.7 x 7.2","velocity":0,"monthsOfStock":null},{"sku":"ME0108","name":"01 DARK CIRCLES","line":"Meline","category":"Commercial","received":336,"sold":231,"stock":73,"price":null,"batch":"T01","expiry":"1/2025","bin":"73","size":"7.5 x 5.2 x 5.2","velocity":0,"monthsOfStock":null},{"sku":"ME0106","name":"01 INTIMATE","line":"Meline","category":"Commercial","received":907,"sold":722,"stock":83,"price":null,"batch":"S08","expiry":"12/2024","bin":"83","size":"9 x 2.8 x 11.5","velocity":0,"monthsOfStock":null},{"sku":"ME0208","name":"02 MELINE INTIMATE","line":"Meline","category":"Commercial","received":607,"sold":370,"stock":205,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EP001","name":"EPIGEN ANTIOX SERUM 30ML","line":"INNO-EPIGEN","category":"Remedy Exclusive","received":26,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EP003","name":"EPIGEN PIGMENT DEF. SERUM 30ML","line":"INNO-EPIGEN","category":"Remedy Exclusive","received":19,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EP004","name":"EPIGEN PURIFYING SERUM 30ML","line":"INNO-EPIGEN","category":"Remedy Exclusive","received":108,"sold":0,"stock":50,"price":null,"batch":"-","expiry":"50","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EP002","name":"EPIGEN AGE PERFECTION SERUM 30ML","line":"INNO-EPIGEN","category":"Remedy Exclusive","received":133,"sold":0,"stock":75,"price":null,"batch":"-","expiry":"75","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE001","name":"IE GLYCO AGE 30ML","line":"INNO-EXFO","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE002","name":"IE MANDELAGE 30ML","line":"INNO-EXFO","category":"R&D","received":19,"sold":0,"stock":10,"price":null,"batch":"-","expiry":"10","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE005","name":"IE MCA 35 5x5ML","line":"INNO-EXFO","category":"R&D","received":12,"sold":0,"stock":10,"price":null,"batch":"-","expiry":"10","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE006","name":"IE BIO C (5+5 AMPx2ML)","line":"INNO-EXFO","category":"R&D","received":14,"sold":0,"stock":7,"price":null,"batch":"-","expiry":"7","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE008","name":"IE ULTIMATE EYE CORRECTOR","line":"INNO-EXFO","category":"R&D","received":9,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE009","name":"IE NEUTRALIZER 100ML","line":"INNO-EXFO","category":"R&D","received":15,"sold":0,"stock":10,"price":null,"batch":"-","expiry":"10","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE010","name":"IE DEGREASING SOLUTION 100ML","line":"INNO-EXFO","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE012","name":"INNO EXFO SKIN RECOVERY 5x5ML","line":"INNO-EXFO","category":"R&D","received":12,"sold":0,"stock":10,"price":null,"batch":"-","expiry":"10","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE013","name":"INNO EXFO TC AGE 5x5ML","line":"INNO-EXFO","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":null,"batch":"-","expiry":"0","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE014","name":"IE XEROSKIN PEEL 6+6x2ML","line":"INNO-EXFO","category":"R&D","received":7,"sold":0,"stock":5,"price":null,"batch":"-","expiry":"5","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE015","name":"IE AKN PEEL 6x2ML","line":"INNO-EXFO","category":"R&D","received":7,"sold":0,"stock":5,"price":null,"batch":"-","expiry":"5","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE017","name":"IE REDNESS PEEL 6x2ML","line":"INNO-EXFO","category":"R&D","received":17,"sold":0,"stock":9,"price":null,"batch":"-","expiry":"9","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE007","name":"IE LIGHTENING 15G","line":"INNO-EXFO","category":"Remedy Exclusive","received":39,"sold":0,"stock":26,"price":null,"batch":"-","expiry":"26","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD044","name":"TDS RESTRUCTURER","line":"Inno TDS","category":"Commercial","received":1160,"sold":660,"stock":372,"price":null,"batch":"10/2024","expiry":"372","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD049","name":"TDS MATRIX","line":"Inno TDS","category":"Commercial","received":1961,"sold":1232,"stock":540,"price":null,"batch":"10/2024","expiry":"540","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD048","name":"TDS FILL UP","line":"Inno TDS","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":0.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID001","name":"SOFT CLEANSER 200ml","line":"Inno Derma","category":"R&D","received":5,"sold":0,"stock":1,"price":1.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID012","name":"HAIR LOTION 70ml","line":"Inno Derma","category":"Commercial","received":90,"sold":80,"stock":0,"price":0.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD046","name":"HAIR VITAL (WOMAN) 4x2.5ml","line":"Inno TDS","category":"Commercial","received":140,"sold":14,"stock":106,"price":106.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD047","name":"HAIR LOSS CONTROL (MAN)  4x2.5ml","line":"Inno TDS","category":"Commercial","received":177,"sold":34,"stock":115,"price":115.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID008","name":"ID SKIN REPAIR 60G","line":"Inno Derma","category":"Remedy Exclusive","received":265,"sold":223,"stock":0,"price":0.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD040MU","name":"TDS FACE NADE SAMPLE","line":"Inno TDS","category":"MKT SAMPLES","received":1685,"sold":0,"stock":0,"price":null,"batch":"0","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD042","name":"DNA PEPT-HA","line":"Inno TDS","category":"Commercial","received":2232,"sold":1693,"stock":264,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID008MU","name":"ID SKIN REPAIR 3GRM SAMPLE","line":"Inno Derma","category":"MKT SAMPLES","received":798,"sold":0,"stock":469,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP114","name":"SkinPen Precision Kit","line":"SKINPEN","category":"Commercial","received":243,"sold":209,"stock":13,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP072","name":"Treatment Kit","line":"SKINPEN","category":"Commercial","received":18564,"sold":17386,"stock":-105,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP146","name":"Lift HG 15ML","line":"SKINPEN","category":"Commercial","received":2162,"sold":1872,"stock":192,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP335","name":"Sterile Biocellulose Masque (24 pcs)","line":"SKINPEN","category":"Commercial","received":7321,"sold":6720,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE016","name":"IE SENSITIVE PEEL","line":"INNO-EXFO","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE018","name":"IE XEROSKIN PEEL HRP","line":"INNO-EXFO","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE019","name":"IE AKN PEEL HRP","line":"INNO-EXFO","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE020","name":"IE SENSITIVE PEEL HRP","line":"INNO-EXFO","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE021","name":"IE REDNESS PEEL HRP","line":"INNO-EXFO","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EP008","name":"BODY CONTOUR","line":"INNO-EPIGEN","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID004","name":"REFRESH MASK","line":"Inno Derma","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID103","name":"SOFT CLEANSER PROFESIONAL","line":"Inno Derma","category":"R&D","received":24,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID104","name":"DEEP CLEANSER PROFESIONAL","line":"Inno Derma","category":"R&D","received":24,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID105","name":"SKIN REPAIR PROFESIONAL","line":"Inno Derma","category":"R&D","received":24,"sold":0,"stock":2,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"ID204","name":"REDUCER CAPS","line":"Inno Derma","category":"R&D","received":5,"sold":0,"stock":5,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD005MU","name":"TDS RESTRUCTURER SAMPLE 1ML","line":"Inno TDS","category":"MKT SAMPLES","received":347,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP364","name":"SP INTL STRESS BALL","line":"SKINPEN","category":"MKT SAMPLES","received":50,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP272","name":"SP INTL HEADBANDS","line":"SKINPEN","category":"MKT SAMPLES","received":200,"sold":0,"stock":71,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP273","name":"SP INTL HANDHELD MIRROR","line":"SKINPEN","category":"MKT SAMPLES","received":50,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP202.1","name":"SP INTL TRAINING FOLDER","line":"SKINPEN","category":"MKT SAMPLES","received":100,"sold":0,"stock":9,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP169","name":"SP INTL PAPER BAGS","line":"SKINPEN","category":"MKT SAMPLES","received":100,"sold":0,"stock":9,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP056","name":"SP 25CARTS/50 SHEATHS (TRAINING)","line":"SKINPEN","category":"MKT SAMPLES","received":175,"sold":0,"stock":52,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LHALA01","name":"LHALA Peel","line":"LHALA","category":"LHALA","received":100,"sold":2,"stock":58,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LHALA02","name":"LHALA Foam","line":"LHALA","category":"LHALA","received":20,"sold":9,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LHALA03","name":"Cleansing Brush","line":"LHALA","category":"LHALA","received":40,"sold":10,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LHALA04","name":"Peeling Brush","line":"LHALA","category":"LHALA","received":20,"sold":10,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LHALA05","name":"LHALA Secret","line":"LHALA","category":"LHALA","received":1,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LHALA06","name":"LHALA Secret Post-Treatment Cream","line":"LHALA","category":"LHALA","received":1,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EX001","name":"EXO-SKIN","line":"INNO-EXOMA","category":"Commercial","received":1095,"sold":625,"stock":272,"price":272.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IC007","name":"BI-DENS 2.5%","line":"INNO-CE","category":"Commercial","received":3275,"sold":1723,"stock":1134,"price":1134.0,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"IE022","name":"SCALPEEL HRP","line":"Inno TDS","category":"R&D","received":25,"sold":14,"stock":8,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT091","name":"INNO USB","line":"Inno Mkt","category":"MKT SAMPLES","received":5,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT150","name":"INNO PRODUCT DISPAY","line":"Inno Mkt","category":"MKT SAMPLES","received":2,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV108","name":"BioJuve Conditioning Cleanse 100ml","line":"BioJuve","category":"BioJuve","received":135,"sold":32,"stock":3,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV107","name":"BioJuve Biome Support Complex 30ml","line":"BioJuve","category":"BioJuve","received":132,"sold":32,"stock":14,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV112","name":"BioJuve Living Biome Essential Duo","line":"BioJuve","category":"BioJuve","received":127,"sold":33,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV109","name":"BioJuve Hydrating Barrier Creme (Normal to Oily Skin) 50ml","line":"BioJuve","category":"BioJuve","received":89,"sold":12,"stock":23,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV110","name":"BioJuve Hydrating Barrier Creme (Normal to Dry Skin) 50ml","line":"BioJuve","category":"BioJuve","received":70,"sold":20,"stock":4,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV114","name":"Biojuve Mini Products in a Cosmetic Bag","line":"BioJuve","category":"BioJuve","received":437,"sold":84,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV156","name":"Biojuve Hero Kit / Discovery Box","line":"BioJuve","category":"BioJuve","received":213,"sold":28,"stock":19,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT111","name":"INNO REGLA / RULER","line":"Inno Mkt","category":"MKT SAMPLES","received":620,"sold":0,"stock":325,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT112","name":"LAPIZ PROMOCIONAL","line":"Inno Mkt","category":"MKT SAMPLES","received":450,"sold":0,"stock":77,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT120","name":"INNO BOLSA TELA / FABRIC BAG","line":"Inno Mkt","category":"MKT SAMPLES","received":868,"sold":0,"stock":165,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT633","name":"MELINE PINCEL / BRUSH","line":"Meline","category":"MKT SAMPLES","received":60,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT155","name":"PELOTA ANTIESTRES INNO","line":"Inno Mkt","category":"MKT SAMPLES","received":50,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT635","name":"PELOTA ANTIESTRES MELINE","line":"Meline","category":"MKT SAMPLES","received":30,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT124","name":"INNO ESPEJO / MIRROR","line":"Inno Mkt","category":"MKT SAMPLES","received":100,"sold":0,"stock":42,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT624","name":"MELINE ESPEJO / MIRROR","line":"Meline","category":"MKT SAMPLES","received":10,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT620","name":"MELINE BOLSA TELA / FABRIC BAG","line":"Meline","category":"MKT SAMPLES","received":59,"sold":0,"stock":46,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"TD051","name":"TDS TIGF 4x2.5ML","line":"Inno TDS","category":"R&D","received":30,"sold":0,"stock":20,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"INVESTA","name":"Q SWITCHED ND:YAG LASER SYSTEM","line":"GTG","category":"Remedy Exclusive","received":4,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"INVESTA 595","name":"595 HAND PIECE","line":"GTG","category":"Remedy Exclusive","received":4,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"INVESTA 660","name":"660 HAND PIECE","line":"GTG","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MACURAY (2in1)","name":"2 IN 1 COOLING SYSTEM","line":"GTG","category":"Remedy Exclusive","received":1,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"Inpure","name":"AQUAPEEL &HYDROGEN & WATER GALVANIC","line":"GTG","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"R7","name":"R7","line":"GTG","category":"Remedy Exclusive","received":10,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"S7","name":"S7","line":"GTG","category":"Remedy Exclusive","received":10,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"LASER CARBON CREAM","name":"LASER CARBON CREAM","line":"GTG","category":"Remedy Exclusive","received":3,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV051.01","name":"BIOJUVE CLINICAL STUDY BOOKLET","line":"BioJuve","category":"BioJuve Mkt","received":1253,"sold":0,"stock":1253,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5BV124","name":"BIOJUVE MICROFIBER CLOTH","line":"BioJuve","category":"BioJuve Mkt","received":50,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F5SP170","name":"SkinPen + BIOJUVE Clinical Study White Paper","line":"BioJuve","category":"BioJuve Mkt","received":50,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F9BV001","name":"BIOJUVE INTL Golden Bag","line":"BioJuve","category":"BioJuve Mkt","received":50,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F9BV020","name":"BIOJUVE A4 Format Cardboard Folder","line":"BioJuve","category":"BioJuve Mkt","received":50,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F9BV021","name":"BIOJUVE - Black NOTEBOOK","line":"BioJuve","category":"BioJuve Mkt","received":50,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"F9BV023","name":"BIOJUVE INTL Ink Pen","line":"BioJuve","category":"BioJuve Mkt","received":100,"sold":0,"stock":100,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"MKT610","name":"MELINE BOLI / PEN","line":"Meline","category":"MKT SAMPLES","received":32,"sold":0,"stock":22,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"INTHERA","name":"INTHERA","line":"GTG","category":"Remedy Exclusive","received":1,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"INTHERA_INSULATED_TIP","name":"INTHEREA 36 PIN INSULATED TIP","line":"GTG","category":"Remedy Exclusive","received":50,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"S-Co2","name":"S-Co2","line":"GTG","category":"Remedy Exclusive","received":2,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"InpureS1Solutions","name":"Inpure S1 Solutions","line":"GTG","category":"Remedy Exclusive","received":3,"sold":0,"stock":3,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"InpureS2Solutions","name":"Inpure S2 Solutions","line":"GTG","category":"Remedy Exclusive","received":3,"sold":0,"stock":3,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"InpureS3Solutions","name":"Inpure S3 Solutions","line":"GTG","category":"Remedy Exclusive","received":3,"sold":0,"stock":3,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"EP010","name":"EPIGEN PERFECT GLOW 150G","line":"INNO-EPIGEN","category":"Remedy Exclusive","received":30,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00008885","name":"TERMOSALUD SILVER BAG","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":80,"sold":0,"stock":20,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00010606","name":"TERMOSALUD LANYARDS","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":50,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00010318","name":"CORPORATIVE MARKETING MIRROR","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":80,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00010317","name":"CORPORATIVE MARKETING VANITY CASE","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":80,"sold":0,"stock":50,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00008631","name":"TERMOSALUD CORPORATIVE PEN","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":100,"sold":0,"stock":70,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00010153","name":"TERMOSALUD CORPORATIVE MUG","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":50,"sold":0,"stock":20,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00008934","name":"TERMOSALUD CORPORATIVE NOTEBOOK","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":80,"sold":0,"stock":20,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00010578","name":"SYMMED ELITE CATALOGUE","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":20,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00010222","name":"SYMMED ELITE CATALOGUE","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":20,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null},{"sku":"AR00009136","name":"CORPORATIVE TERMOSALUD FOLDER","line":"TERMOSALUD MKT","category":"MKT SAMPLES","received":30,"sold":0,"stock":0,"price":null,"batch":"","expiry":"","bin":"","size":"","velocity":0,"monthsOfStock":null}];
const FILE_ID = '1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';
let DATA = SEED.slice();
let BATCHES = [];
let MONTHLY_IN = {};
let MONTHLY_OUT = {};
let MONTHS = [];
let VALUE_BY_LINE = {};
let REORDER = {}; // sku -> threshold (stored in localStorage-like obj, session only)
let CASH_EXPIRING = {};
let EXPIRING_ITEMS = [];
let BRANCH_TRANSFERS = [];
let BRANCH_EXPIRY = {};
let CUSTOMERS = [];
let SHOPIFY = null;
let SALESIDX = null;              // base-SKU sales index built from Shopify variants
let ORDIDX = null;                // base-SKU → recent orders (order #, customer, specialist)
let TARGETS = [];                 // sales targets from the sheet's optional Targets tab
let ACCT = null;                  // accounting's official Sales Booked (from the Healthspan Sales Report sheet)
let SPERIOD = 'mtd';              // shared period for the Sales views
let SLINE = null;                 // line filter for Sales views (null = auto-default to Meso)
let SFROM = '', STO = '';         // custom date range (YYYY-MM-DD) when SPERIOD === 'custom'

/* Endpoints are locked behind the Supabase session — every data fetch carries it */
async function sbAuthHeaders(extra){
  const h=Object.assign({},extra||{});
  try{
    if(typeof SB!=='undefined'&&SB){
      const {data:{session}}=await SB.auth.getSession();
      if(session)h['Authorization']='Bearer '+session.access_token;
    }
  }catch(e){}
  return h;
}

/* ── SHOPIFY MERGE: prices & deals & demand from the store; stock stays with the sheet ── */
let SHOPIFY_ERR=null; // last build error from /api/shopify status, if any
async function loadShopify(){
  try{
    const r=await fetch('/api/shopify',{headers:await sbAuthHeaders()});
    if(r.status===401){setTimeout(loadShopify,8000);return;} // not signed in yet — retry after login
    const d=await r.json();
    SHOPIFY_ERR=(d&&d.status&&d.status.state==='error')?d.status.error:null;
    if(d&&d.variants){
      SHOPIFY=d;mergeShopify();refreshSidebar();rerenderCurrent();
      if(d.v!==8)setTimeout(loadShopify,45000); // old format still cached: merge triggered a rebuild — keep polling until the new blob lands
    }
    else if(d&&d.building){
      setTimeout(loadShopify,15000);
      if(String(currentView||'').startsWith('sales'))rerenderCurrent(); // surface build errors on Sales views
    }
  }catch(e){}
}
function mergeShopify(){
  if(!SHOPIFY||!SHOPIFY.variants||!DATA.length)return;
  const isNew=SHOPIFY.v>=2;
  if(SHOPIFY.v!==8){try{sbAuthHeaders().then(h=>fetch('/api/shopify?refresh=1',{headers:h}));}catch(e){}} // old cache format — trigger a rebuild
  const sheetSkus=new Set(DATA.map(p=>p.sku));
  const bases=[...sheetSkus].sort((a,b)=>b.length-a.length); // longest-prefix wins
  // Unit rules (validated on real orders): physical units are itemized as base-SKU
  // lines; deal/bundle lines carry the deal REVENUE. A base line in an order that also
  // has a deal line for it = deal units (deal sold as a whole, +1s are NOT free items);
  // a ₱0 base line with no deal line = true free giveaway.
  const gU=c=>isNew?(c?c.u:0):(typeof c==='number'?c:0);
  const gF=c=>isNew&&c?(c.f||0):0;
  const gV=c=>isNew&&c?(c.v||0):0;
  const gD=c=>isNew&&c?(c.d||0):0;
  const gDV=c=>isNew&&c?(c.dv||0):0;
  SALESIDX={};
  for(const v of SHOPIFY.variants){
    let base=null,isBundle=false,isPseudo=false;
    if(sheetSkus.has(v.sku))base=v.sku;
    else{
      base=bases.find(b=>v.sku.startsWith(b)&&v.sku.length>b.length);           // prefix ("TD040 - AGF")
      if(!base)base=bases.find(b=>b.length>=4&&v.sku.length>b.length&&v.sku.includes(b)); // contains ("DLTD040184")
      isBundle=!!base;
    }
    if(!base){
      // No sheet match at all (package/mix SKUs like PK0114, DL0201, MIXTDS04):
      // keep it visible as a Shopify-only product so revenue is never dropped.
      let has=false;for(const k in (v.monthly||{}))if(gV(v.monthly[k])>0||gU(v.monthly[k])>0){has=true;break;}
      if(!has)continue;
      base=v.sku;isPseudo=true;
    }
    const S=SALESIDX[base]||(SALESIDX[base]={main:null,bundles:[],monthly:{},daily:{},bmonthly:{},bdaily:{}});
    if(isPseudo){S.pseudo=true;S.name=(v.productTitle||v.sku);S.line='SHOPIFY ONLY';}
    if(isBundle)S.bundles.push(v);else S.main=v;
    // base lines → monthly/daily (units + revenue); bundle lines → bmonthly/bdaily (deal revenue only)
    const addAgg=(dst,src)=>{for(const k in (src||{})){const c=src[k];const d=dst[k]||(dst[k]={u:0,f:0,v:0,d:0,dv:0});
      if(!isBundle){d.u+=gU(c);d.f+=gF(c);d.d+=gD(c);d.dv+=gDV(c);}d.v+=gV(c);}};
    addAgg(isBundle?S.bmonthly:S.monthly,v.monthly);
    addAgg(isBundle?S.bdaily:S.daily,v.daily);
  }
  // Order-level drill-down index: base SKU → orders that touched it
  ORDIDX={};
  const resolveBase=sku=>{
    if(sheetSkus.has(sku))return sku;
    return bases.find(b=>sku.startsWith(b)&&sku.length>b.length)||
           bases.find(b=>b.length>=4&&sku.length>b.length&&sku.includes(b))||sku;
  };
  for(const o of (SHOPIFY.recent||[])){
    const per={}; // base → {q,a} within this order
    for(const [sku,q,a] of (o.ls||[])){
      const s=String(sku||'').trim();
      const base=resolveBase(s);
      const p=per[base]||(per[base]={q:0,a:0});
      if(base===s)p.q+=q||0; // physical units come from base lines; deal/bundle lines add revenue only
      p.a+=a||0;
    }
    for(const base in per){
      (ORDIDX[base]||(ORDIDX[base]=[])).push({n:o.n,dt:o.dt,t:o.t||'',c:o.c||'',q:per[base].q,a:per[base].a});
    }
  }
  for(const k in ORDIDX)ORDIDX[k].sort((a,b)=>b.dt<a.dt?-1:b.dt>a.dt?1:0);
  for(const p of DATA){
    const S=SALESIDX[p.sku]; if(!S)continue;
    S.name=p.name; S.line=p.line;
    if(p.priceSheet===undefined)p.priceSheet=p.price;         // keep the sheet price for reconciliation
    if(S.main&&S.main.price>0){p.price=S.main.price;p.priceSrc='shopify';}
    if(S.main&&S.main.inv!=null)p.shopifyInv=S.main.inv;
    p.deals=S.bundles.filter(b=>b.setSize).map(b=>({title:b.productTitle,setSize:b.setSize,price:b.price}));
    const sales={}; let any=false;
    for(const ym in S.monthly){if(S.monthly[ym].u>0){sales[ym]=S.monthly[ym].u;any=true;}}
    if(any)p.shopifySales=sales;
  }
}
// Sum a {monthly:{ym:{u,f,v}}, daily:{date:{u,f,v}}} aggregate over the selected period.
function sumPeriod(S,mode){
  const out={u:0,f:0,v:0,d:0,dv:0};
  const add=c=>{out.u+=c.u||0;out.f+=c.f||0;out.v+=c.v||0;out.d+=c.d||0;out.dv+=c.dv||0;};
  const today=new Date().toISOString().slice(0,10);
  const cutoff=d=>new Date(Date.now()-d*864e5).toISOString().slice(0,10);
  const ymNow=today.slice(0,7);
  if(mode==='today'){const c=(S.daily||{})[today];if(c)add(c);}
  else if(mode==='yest'){const y=new Date(Date.now()-864e5).toISOString().slice(0,10);const c=(S.daily||{})[y];if(c)add(c);}
  else if(mode==='custom'){for(const d in (S.daily||{}))if((!SFROM||d>=SFROM)&&(!STO||d<=STO))add((S.daily||{})[d]);}
  else if(mode==='7d'||mode==='30d'){const lim=cutoff(mode==='7d'?7:30);for(const d in (S.daily||{}))if(d>=lim)add((S.daily||{})[d]);}
  else if(mode==='mtd'){const c=(S.monthly||{})[ymNow];if(c)add(c);}
  else if(mode==='3m'){const lim=new Date();lim.setMonth(lim.getMonth()-2);const l=lim.toISOString().slice(0,7);for(const m in (S.monthly||{}))if(m>=l)add((S.monthly||{})[m]);}
  else {for(const m in (S.monthly||{}))add((S.monthly||{})[m]);} // all (13 months)
  return out;
}
function rerenderCurrent(){
  const k={l:fLine,c:fCat,s:fSearch,t:fTab,b:fBin,su:fSup};
  showView(currentView,null);
  fLine=k.l;fCat=k.c;fSearch=k.s;fTab=k.t;fBin=k.b;fSup=k.su;
  if(currentView==='all'||currentView==='line')renderTable();
}
let COLLISIONS = [];
let PLAN = (()=>{try{return Object.assign({lead:30,cover:3,safety:14,service:95},JSON.parse(localStorage.getItem('hs_plan')||'{}'));}catch(e){return {lead:30,cover:3,safety:14,service:95};}})();
/* Per-line supplier lead times (days). Imported brands ship longer than local/marketing items. All editable in the Reorder point view. */
const LEAD_DEFAULTS={'Inno Derma':60,'Inno TDS':60,'INNO-CE':60,'INNO CE':60,'INNO-EXFO':60,'INNO-EXFO LI':60,'INNO-EPIGEN':60,'INNO-EXOMA':60,'Inno Mkt':60,'Meline':60,'Meline MKT':60,'Meso':60,'TERMOSALUD':60,'TERMOSALUD MKT':60,'BioJuve':45,'BioJuve Mkt':45,'SKINPEN':45,'SKINPEN MKT':45,'LHALA':45,'HYALURONIDA':45,'GTG':90};
let LEADMAP=(()=>{try{return Object.assign({},JSON.parse(localStorage.getItem('hs_leadmap')||'{}'));}catch(e){return {};}})();
function leadFor(line){if(LEADMAP[line]!=null)return LEADMAP[line];if(LEAD_DEFAULTS[line]!=null)return LEAD_DEFAULTS[line];return PLAN.lead||45;}
function zFor(s){return s>=99?2.33:s>=97.5?1.96:s>=95?1.645:s>=90?1.28:1.04;}
function dtsBaseline(p){const s=stk(p);const dbar=(p.velAdj!=null?p.velAdj:(p.velocity||0));if(s===null||dbar<=0)return null;if(s<=0)return 0;return Math.round(s/(dbar/30.44));}
function ropCalc(p){
  const dbar=(p.velAdj!=null?p.velAdj:(p.velocity||0)); // expected monthly demand
  const lead=leadFor(p.line);
  const leadMo=lead/30.44;
  const demandLead=dbar*leadMo;
  const sdMo=(p.demandStd!=null?p.demandStd:0);
  const sdLead=sdMo*Math.sqrt(Math.max(0,leadMo)); // demand-over-lead std dev (independence assumption)
  const z=zFor(PLAN.service);
  const safety=Math.ceil(z*sdLead);
  const rop=Math.ceil(demandLead+safety);
  const s=stk(p);
  return {dbar,lead,leadMo,demandLead,sdLead,z,safety,rop,s,below:(s!=null&&dbar>0&&s<=rop),dts:dtsBaseline(p)};
}
function cvBadge(p){
  if(p.cv==null||p.demandClass==='insufficient')return '<span class="pill pgy" title="Not enough sales history">n/a</span>';
  const c=p.demandClass==='steady'?'pgr':p.demandClass==='variable'?'pam':'prd';
  const lbl=p.demandClass==='steady'?'Steady':p.demandClass==='variable'?'Variable':'Lumpy';
  return '<span class="pill '+c+'" title="CV = std dev ÷ mean of monthly demand">'+lbl+' '+p.cv.toFixed(2)+'</span>';
}
let WHATIF = {mult:1, delay:0};
let SIMPROMO = {lift:30, disc:20};
let SIMBUDGET = {budget:2000000};
let SIMSVC = {level:PLAN.service};
let SIMSURGE = {group:'', lift:100, weeks:6};
let SIMMONTE = {horizon:60};
let SIMPROJ = {sku:''};
let SIMBULK = {disc:10, hold:2, shelf:18, months:6};
let SIMBRANCH = {minMove:10};
let projInst=null, cashInst=null, covInst=null;
let _randSpare=null;
function randn(){ // standard normal (Box-Muller with cached spare)
  if(_randSpare!=null){const s=_randSpare;_randSpare=null;return s;}
  let u=0,v=0,s=0;
  do{u=Math.random()*2-1;v=Math.random()*2-1;s=u*u+v*v;}while(s>=1||s===0);
  const m=Math.sqrt(-2*Math.log(s)/s);_randSpare=v*m;return u*m;
}
let sortCol='stock', sortDir=-1;
let currentView='home';
let fLine='',fCat='',fSearch='',fTab='all',fBin='',fSup='';
let catInst=null, movInst=null;
const COLORS=['#1D9E75','#378ADD','#7F77DD','#D85A30','#BA7517','#D4537E','#0F6E56','#639922','#185FA5','#854F0B','#993556','#3B6D11','#27500A','#5D4A8F','#8B3A3A'];

/* Plain-language explanation shown at the top of each tab (toggle with the Tips button). */
const DESC={
  dashboard:'Your at-a-glance overview — total stock, what’s running out, what’s expiring, and value by product line. A good place to start each day.',
  action:'Your daily to-do in one place — what to <b>order now</b>, what to <b>promo or move</b> before it expires, what to <b>review</b>, and dead stock to clear. Pulls together the whole app so nobody has to hunt across tabs.',
  health:'A completeness check on the data behind every forecast — SKUs missing a <b>price, expiry, batch, or bin</b>, negative stock, and items with too little sales history. Fixing these in the source sheet sharpens the whole app. Higher score = cleaner data.',
  customers:'Who Healthspan sells to — accounts ranked by value, order cadence, and whether they’re <b>growing, declining, or dormant</b>. Also shows how concentrated you are on Remedy. Built from the destination column of the OUT sheet; Remedy’s branches are grouped as one account.',
  all:'Every product in one searchable table. Filter by line or category and click any row for full detail. <b>Days→out</b> is how long stock lasts at the current sales pace.',
  oos:'Products that have hit zero stock — these need reordering now.',
  low:'Products with fewer than 10 units left — running thin.',
  neg:'Products showing negative stock, which usually points to a miscount or data slip worth checking.',
  expiry:'Batches sorted by expiry date, soonest first. Use it to decide what to sell or use up before it expires.',
  reorder:'Products that have dropped below their reorder point (or a threshold you set) and should be reordered.',
  forecast:'Predicts when each product will run out, using recent sales trend and seasonality. Order the red ones first.',
  coverage:'How much runway you have — <b>weeks or months of stock left</b> at the current sales pace, per product. The chart groups SKUs from critically low to overstocked; the list ranks them lowest-cover first. Toggle weeks/months up top.',
  reorderplan:'Turns the forecast into a shopping list — how much to order of each item and the estimated cost. Adjust lead time and coverage up top, then export a draft PO.',
  ropoint:'The “buy-again” level for each product, based on how fast it sells and how erratic demand is. Stock at or below the reorder point means it’s time to order.',
  variability:'Sorts products into <b>steady</b>, <b>variable</b>, and <b>lumpy</b> by how consistent their sales are — so you know which forecasts to trust and which need a human eye.',
  abc:'Ranks products by how much of your sales value they drive. <b>A-items</b> are the vital few to watch and count most closely.',
  writeoff:'Estimates how much stock will expire unsold at the current pace, and the peso value at risk. Tackle the biggest ones first.',
  whatif:'Play out a scenario — change demand or delay the next shipment — and see the effect on stockouts, write-offs, and spend.',
  simpromo:'Tests whether discounting near-expiry stock pays off: set how much faster a promo sells and the discount offered, and see write-off avoided versus margin given up.',
  simbudget:'Given a set purchasing budget, it chooses what to order first to prevent the most stockouts — urgent and high-value items lead.',
  simservice:'Shows the trade-off between service level and cash: a higher target means fewer stockouts but more money parked in safety stock.',
  simsurge:'Model a campaign that spikes demand for a product line, and see which items would run out and how much to pre-buy.',
  simmonte:'Rather than a single guess, it simulates each product’s demand hundreds of times to give a <b>probability</b> of stocking out — accounting for how unpredictable each one is.',
  simproject:'A 12-month forecast for one product: projected demand, a declining stock line showing when it runs out, and a confidence band around it.',
  simcash:'Projects inventory cash over six months — restocking spend versus sales coming in — so you can see when cash is most tied up.',
  simbulk:'Checks whether a volume discount is worth it: weighs the savings against extra holding cost and the risk of stock expiring before it sells.',
  simbranch:'Suggests moving stock between <b>Remedy’s</b> branches (BGC, Vertis North, Greenhills) to balance each site’s share and use up near-expiry stock. Remedy is a sister company and a customer; this is based on what Healthspan has shipped to them.',
  movement:'Units received versus sold each month over the past year — the pulse of what’s coming in and going out.',
  value:'Where your inventory money sits, broken down by product line.',
  dealvalue:'What the current stock is worth <b>if everything sells à la carte</b> versus through the bundle deals (2+1 up to 6+1, where the +1 is free). Prices are live from Shopify where connected (sheet price otherwise). Supplier/landed cost isn’t in the system yet, so this is revenue, not profit.',
  batches:'Every batch in FEFO order (first to expire, first out) — the sequence to pull stock in.',
  aged:'Products that haven’t sold in a while, grouped into aging, slow, and dead stock — candidates for a promo or clear-out.',
  shrinkage:'Flags gaps between what was received/sold and what’s actually on hand — possible loss, miscounts, or unrecorded movement.',
  cashexpiry:'The peso value tied up in stock that’s expiring soon, bucketed by urgency.',
  branchtransfer:'A log of product Healthspan has shipped to <b>Remedy’s</b> clinic branches — BGC, Vertis North, Greenhills — from 2025 onward. Remedy is a sister company and a customer.',
  branchexpiry:'For each <b>Remedy</b> branch, the stock Healthspan shipped there sorted by expiry — so each clinic can see what to use up first.',
  salesoverview:'Booked sales from Shopify (the specialists’ booking POS): units sold and revenue per product over an adjustable period, split into <b>via deals</b> (deals count as a whole — +1s are deal units, not freebies), <b>à la carte</b>, and <b>free</b> (true giveaways). The Stock now column puts sales against inventory at a glance.',
  salesdeals:'Do the bundles outsell single-unit pricing? Per product: units and revenue moved through deals versus à la carte, the effective per-unit price inside a deal (revenue ÷ all units including the +1), and the effective discount versus the à-la-carte price.',
  logvisit:'For the product specialists, from the iPad: log every doctor/clinic visit in ~10 seconds — even when there’s no order. Pick your name once and it’s remembered. Logged visits count toward Field coverage and build Healthspan’s own visit history (the start of our own CRM).',
  ar:'Who owes what, and for how long: every unpaid balance bucketed into current / 31–60 / 61–90 / 90+ days, per account. Ages count from the order date plus any terms noted on the order (e.g. “PDC 30 days” — parsed from Shopify notes automatically). Payment statuses come from Shopify (accounting marks paid there); re-running the backfill syncs them. Record payments on HS-orders from their order page.',
  spec:'One specialist’s whole world: this month vs target, the calendar of planned and logged visits plus orders (tap any day), monthly sales chart with the target line, top products, open follow-ups and recent activity. Specialists land here on sign-in; managers and admins reach it from the Specialists view.',
  approvals:'The sign-off queue: specialist orders that trip a credit limit or the big-order threshold are held here — approve to release them to fulfillment, reject to cancel with the reason on record. Credit limits are set by finance on account pages; the threshold is a super-admin setting on this page.',
  commissions:'Finance computes incentives here instead of by hand: per specialist, booked vs target, the rate tier reached, and the commission — any month, exportable as the payroll input. Rate tiers are editable (finance/admin) and every change is audited.',
  quotes:'Formal quotations for clinics: build a quote with the same pricing as an order, print it, mark it sent/accepted/lost, and convert an accepted quote to an order in one tap. Win rate is tracked from outcomes.',promos:'Promotions as configuration instead of free-typed deal lines: define a mechanic (buy-N-get-M free, or % off), a validity window, and the eligible SKUs — order entry applies it automatically while the promo is live.',cashflow:'Expected collections, week by week: receivables land in the week their payment terms mature, post-dated cheques in the week they can be deposited. Overdue money gets its own bucket. The forward view of cash that AR aging (which looks backward) can\u2019t give.',cyclecount:'Cycle counts: pick a scope, count physically (blind — expected quantities are hidden), and the session grades itself against the stock truth. Two matching counts in a row are the evidence that lets the ledger replace the sheet. After cutover, closing a count writes the corrections straight into the ledger.',regs:'CPR/FDA product registrations per SKU with expiry dates — expired and expiring-soon registrations float to the top so renewals never slip.',salesevents:'One calendar for the room: campaigns, demos, trainings, and planned visits in a single month grid — Mench’s weekly Calendar of Events, live. Specialists see their own visits; everyone sees campaigns.',
  pipeline:'The funnel, staged: lead → contacted → qualified → active. Stages start from real behavior and every manual move is audited. Add opportunities (big deals) with estimated value and expected close month — cards show weighted pipeline value and win rate. Specialists see their own; managers see everyone.',
  po:'Purchase orders and receiving. Draft the PO, add lines, mark it ordered; when stock arrives, receive per line — batch and expiry captured at the door, written straight into the stock ledger. Statuses roll to partially received / received automatically. Unit costs feed margin reporting.',
  recall:'The one-bad-day feature: enter a SKU and/or batch number and get every clinic that ever received it — dates, quantities, order refs — as a printable contact list. Sources: every OUT-sheet shipment row plus the platform ledger. Fast, complete, and audited.',
  scorecards:'Quarterly performance reviews, filled from the numbers instead of memory: booked vs target, trend vs the previous quarter, visits, accounts touched, and peso-per-visit efficiency — plus a rating and comments per specialist that save per quarter. Print all for the review meeting. Managers and admins only; comments are never shown to specialists in-app.',
  salesdue:'Accounts past their usual buying rhythm. The cycle is learned from each account’s own order history (median gap between orders, 3+ orders needed). They buy on rhythm — a call today is the reminder that beats the competitor’s. Specialists see their own accounts; managers see everyone’s.',
  catalog:'The item master — products, prices, costs, and barcodes owned in-app. While in shadow mode, Shopify still prices the app; use this page to fix drift (⚠ rows) and add costs, then declare pricing independence on the Cutover switches page. Costs entered here unlock margin reporting.',
  returns:'Returns and credit memos with permanent CM numbers. Record what came back, whether it restocks or gets written off, and print the CM for accounting. Admins can apply a CM against the linked order’s balance so AR stays honest. During the parallel run, process the return in Shopify too.',
  scan:'Warehouse scanning: receive stock in, pick orders out, or record physical counts — by camera (Chrome/Android) or by typing the code. Movements build the platform’s stock ledger. Until independence is declared, this ledger is a SHADOW for comparison; Verna’s sheet remains the truth.',
  cutover:'The declaration of independence. Each switch moves one source of truth from the legacy system (Shopify pricing, Shopify order entry, Verna’s sheet) to this platform — with the readiness case shown beside it. Flips are reversible, audited, and should follow the cutover playbooks in the roadmap.',
  salespace:'The month-to-date race and the finish-line projection. Pace = what you’ve booked ÷ how much of the month has passed, against your target — green means on pace for 100%. Managers: coach the amber and red rows while the month can still be saved. Tap any row for the specialist’s page.',
  pdc:'Every post-dated cheque, tracked to maturity: who issued it, which bank, how much, and when it can be deposited. Highlighted rows are due — deposit them. Mark cleared once the bank confirms (and record the payment on the order), or bounced to keep it visible until replaced.',
  fcastacc:'The honest test of the forecast: at the start of each month the model’s prediction per SKU is frozen; a month later it’s scored against what actually moved. MAPE = average % miss per SKU. Big misses at the top are where the model — or an unplanned event — needs a look. This history is what any smarter forecasting must beat.',
  campaigns:'Planned promos and campaigns as a demand signal. Anything added here shows as a banner on the stockout forecast and feeds the AI planning review, so a "10+8 anniversary promo" stops being a forecast surprise. Precursor to the full promotions engine.',
  planreview:'Demand planning AI: walks every SKU (stock, velocity, days-to-stockout, expiry) plus the campaign calendar and recent forecast misses, then reports the exceptions — stockout risks, expiry money, and 5 prioritized actions. An analyst, not an oracle: sanity-check quantities before ordering.',
  targets:'Set each product specialist’s monthly peso target (admins & sales managers). Values saved here override the sheet/corporate numbers for that specialist and month across the whole app — Vs target, the Specialists view, and each specialist’s own page. Blank rows keep the sheet value; "Copy from last month" pre-fills, then adjust and save.',
  audit:'Every change, logged automatically: orders created and fulfilled, payments recorded, shipments dispatched, accounts merged, users managed — who did it and when. The paper trail for when a number looks off.',
  users:'Create, edit, and disable team accounts without opening Supabase. Add someone with a starter password, change roles and specialist tags, reset passwords, and disable accounts (kept, just blocked from signing in). Disabled accounts can be re-enabled any time.',
  fulfillq:'Verna’s daily worklist: every pending order, oldest first, with age flags (red past a week). Tap an order to fulfill or cancel it, or print the Pick list — a FEFO pull sheet that names the exact batch and bin for every line, doubling as the packing slip / delivery receipt.',
  account:'Everything about one account in one place: booked (Shopify) and shipped (warehouse) totals, the full timeline of orders, visits and shipments, what they buy, and the editable CRM details — contact person, phone, address, specialty, notes — shared by the whole team. Name spellings across systems are merged automatically.',
  followups:'The team’s to-do list, generated by the visit log: every visit whose outcome was <b>Follow-up needed</b> stays here until ticked done, and every visit logged with a future date shows as a <b>planned visit</b> (overdue ones flagged). Specialists see their own; managers and admins see everyone’s. Tap an account name to open its profile.',
  salesfield:'Veeva-style field activity per specialist, built from bookings: how many accounts each specialist reached in the period vs their own account universe (≈6 months), orders per active day, samples given, and — most useful — the <b>accounts not reached</b> list, sorted by value, as a ready follow-up sheet. A booking counts as contact; visits without an order would need a call log (phase 2).',
  salesrecon:'Peso-for-peso check against the official <b>2026 Healthspan Sales Report</b> (accounting’s Google Sheet, read live at every sync). Accounting’s Sales Booked excludes Remedy, so the dashboard applies the same rule: external = all booked orders minus Remedy/Healthspan-internal tags. The Δ column shows exactly how far apart the two systems are each month and why.',
  salesfree:'Items given away at ₱0 <b>outside any deal</b> — samples, marketing, goodwill — kept separate from sales. Deal +1s are not here; they count as deal units. Shows what the giveaways would be worth at list price and how the rate compares with remaining inventory.',
  salestarget:'Actual booked sales versus the monthly targets set in the sheet’s <b>Targets</b> tab — total, per line, and per product. If the tab doesn’t exist yet, this view shows exactly how to set it up.',
  salesspec:'Each product specialist’s booked sales — revenue and units — over an adjustable period, and against their monthly target if one is set. Specialists are read from the order’s first tag in Shopify (e.g. Rhas, Frank, Ruth, Charmaine).'
};
/* "How is this calculated" methodology, shown as a collapsible panel on planning/forecast tabs. */
const VELOCITY_BASIS='<b>Forecast monthly demand</b> is built from actual outbound movement — not opening balances:<ol>'+
  '<li><b>Base velocity</b> — average units shipped out per month over the last 6 complete months (from the Sending Inventory OUT sheet).</li>'+
  '<li><b>Trend</b> — the last 3 months are compared with the 3 before; a rising or falling SKU bends the forecast up or down (capped so one odd month can’t distort it).</li>'+
  '<li><b>Seasonality</b> — if a SKU has a repeating month-of-year pattern, that month’s index is applied.</li></ol>'+
  'SKUs without enough history fall back to the plain 6-month average.';
const CALC={
  coverage:{t:'How stock coverage is calculated',b:
    '<span class="fx">Coverage (months) = stock on hand ÷ forecast monthly demand\nCoverage (weeks)  = months × 4.345</span>'+
    VELOCITY_BASIS+
    '<div style="margin-top:9px"><b>Bands:</b> under 2 weeks = Critical · 2–4 weeks = Low · 1–2 months = OK · 2–4 months = Healthy · over 4 months = Overstock.</div>'+
    '<div class="note">Example: 2,200 units on hand ÷ 190 per month = 11.6 months ≈ 50 weeks → Overstock. SKUs with no stock or no recent sales are excluded — runway can’t be computed without movement.</div>'},
  forecast:{t:'How the stockout forecast is calculated',b:
    VELOCITY_BASIS+
    '<div style="margin-top:9px">Stock is then run down <b>month by month</b> against that forecast until it hits zero; the day it crosses is the projected stockout date.</div>'+
    '<span class="fx">days to stockout = simulate( stock − forecast demand, month by month )</span>'+
    '<div class="note">Because it steps through each month, seasonal and trending SKUs run out at different speeds than a flat average would suggest. Beyond 12 months it simply reports “>12 mo”.</div>'},
  reorderplan:{t:'How order quantities are calculated',b:
    '<span class="fx">order qty = demand over (lead time + coverage + safety) − stock on hand</span>'+
    'Demand is integrated across the forecast curve for that whole window, so seasonality is respected.'+
    '<div style="margin-top:9px"><b>Your three controls:</b> <b>lead time</b> (how long the supplier takes), <b>coverage</b> (how many months you want to hold after it lands), <b>safety</b> (extra days of buffer).</div>'+
    '<div class="note">Highlighted rows run out <i>before</i> the shipment can arrive — those are already late. Est. cost = qty × unit price, so SKUs missing a price show blank (see Data health).</div>'},
  ropoint:{t:'How the reorder point is calculated',b:
    '<span class="fx">reorder point = (forecast demand/mo × lead months) + safety stock\nsafety stock  = z × σ(demand) × √lead months</span>'+
    '<b>In plain terms:</b> cover the demand you expect while waiting for the supplier, plus a cushion sized to how <i>unpredictable</i> that SKU is.'+
    '<ol><li><b>z</b> comes from your service level (95% → 1.65). Higher service = bigger cushion.</li>'+
    '<li><b>σ (sigma)</b> is the standard deviation of monthly demand — steady SKUs get a small buffer, lumpy ones a large one.</li>'+
    '<li><b>Lead time</b> is per product line, editable on that tab.</li></ol>'+
    '<div class="note">Stock at or below the reorder point means it’s time to order. This also drives the Reorder alerts badge unless you set a manual threshold on a SKU.</div>'},
  variability:{t:'How demand variability (CV) is calculated',b:
    '<span class="fx">CV = standard deviation of monthly demand ÷ average monthly demand</span>'+
    'A unitless measure of how erratic a product’s sales are, so a slow SKU and a fast SKU can be compared fairly.'+
    '<div style="margin-top:9px"><b>Steady</b> CV &lt; 0.5 · <b>Variable</b> 0.5–1.0 · <b>Lumpy</b> &gt; 1.0 or mostly zero-sale months · <b>Insufficient</b> under 3 months of history.</div>'+
    '<div class="note">Leading months with no sales are trimmed so newly launched SKUs aren’t unfairly penalised. CV feeds the safety-stock cushion on the Reorder point tab.</div>'},
  abc:{t:'How ABC classes are assigned',b:
    '<span class="fx">consumption value = units moved (6 months) × unit price</span>'+
    'SKUs are ranked by that value, then split on cumulative share: <b>A</b> = top 80%, <b>B</b> = next 15%, <b>C</b> = the rest.'+
    '<div class="note">Classic Pareto: A-items are the vital few that deserve tight control, frequent counts and priority when budget is short. SKUs with no price can’t be valued — fix those in Data health.</div>'},
  dealvalue:{t:'How deal-scenario values are calculated',b:
    '<span class="fx">à la carte value = stock × SRP\ndeal value (N+1) = (stock − free units) × SRP\nfree units       = ⌊ stock ÷ (N+1) ⌋</span>'+
    'In an <b>N+1 deal</b>, every full set of N+1 units contains one free unit. Leftover units that don’t complete a set still sell at full SRP — so the math is exact, not a flat percentage.'+
    '<div style="margin-top:9px">Example: 100 units on a <b>3+1</b> deal → 25 full sets → 25 free units → 75 units paid → value = 75 × SRP (a 25% giveaway).</div>'+
    '<div class="note">Caveats: prices come live from Shopify where the SKU exists there (green “Shopify” badge in the product drawer, confirmed aligned with the master sheet), otherwise from the sheet. Sheet-vs-Shopify disagreements are flagged in Data health. Supplier cost and landed cost (forex, fees, taxes, shipping) are not in the system yet, so these figures are potential REVENUE, not profit or margin. SKUs without any price are excluded entirely.</div>'},
  writeoff:{t:'How write-off risk is calculated',b:
    'Each batch is checked against how fast that SKU actually sells, in <b>FEFO order</b> (earliest expiry first):'+
    '<span class="fx">sellable before expiry = daily demand × days to expiry − stock ahead in the queue\nprojected expired = batch stock on hand − sellable\nwrite-off value   = projected expired × unit price</span>'+
    '<div class="note">“Stock ahead” matters: batches queued in front consume the demand first, so a later batch can expire even when the SKU sells well. Sort by write-off value to find the costliest exposure.</div>'}
};
function calcPanel(v){
  const c=CALC[v]; if(!c)return '';
  const open=localStorage.getItem('hs_calc_'+v)==='1';
  return '<div class="calcbox'+(open?' open':'')+'" id="calc-'+v+'"><div class="calchd" onclick="toggleCalc(\''+v+'\')">'+
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>'+
    c.t+'<svg class="cx" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>'+
    '<div class="calcbody">'+c.b+'</div></div>';
}
function toggleCalc(v){
  const el=document.getElementById('calc-'+v); if(!el)return;
  el.classList.toggle('open');
  try{localStorage.setItem('hs_calc_'+v,el.classList.contains('open')?'1':'0');}catch(e){}
}
function injectCalc(v){
  if(!CALC[v])return;
  const c=document.getElementById('content'); if(!c||c.querySelector('.calcbox'))return;
  const d=c.querySelector('.viewdesc');
  const tmp=document.createElement('div'); tmp.innerHTML=calcPanel(v);
  const box=tmp.firstChild;
  if(d&&d.nextSibling)c.insertBefore(box,d.nextSibling); else if(d)c.appendChild(box); else c.insertBefore(box,c.firstChild);
}
let TIPS_ON = localStorage.getItem('hs_tips')!=='off';
let TIP_SEEN = (()=>{try{return JSON.parse(localStorage.getItem('hs_tipseen')||'{}');}catch(e){return {};}})();
function injectDesc(v){
  const c=document.getElementById('content'); if(!c) return;
  const old=c.querySelector('.viewdesc'); if(old) old.remove();
  if(!TIPS_ON) return;
  const d=DESC[v]; if(!d||TIP_SEEN[v]) return;
  const div=document.createElement('div');
  div.className='viewdesc';
  div.innerHTML='<svg class="vd-i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg><div class="vd-t">'+d+'</div><button class="vd-x" onclick="dismissDesc(\''+v+'\')" title="Hide this tip">×</button>';
  c.insertBefore(div,c.firstChild);
}
function dismissDesc(v){TIP_SEEN[v]=true;try{localStorage.setItem('hs_tipseen',JSON.stringify(TIP_SEEN));}catch(e){}const c=document.getElementById('content');const old=c&&c.querySelector('.viewdesc');if(old)old.remove();}
function toggleTips(){
  TIPS_ON=!TIPS_ON;
  try{localStorage.setItem('hs_tips',TIPS_ON?'on':'off');}catch(e){}
  if(TIPS_ON){TIP_SEEN={};try{localStorage.setItem('hs_tipseen','{}');}catch(e){}}
  const b=document.getElementById('tipsBtn'); if(b) b.style.opacity=TIPS_ON?'1':'0.55';
  injectDesc(currentView);
}

const $=id=>document.getElementById(id);
const stk=p=>{ // stock truth: sheet — until ledger_is_truth flips, then the platform ledger
  try{
    if(window.FLAGS&&FLAGS.ledger_is_truth==='on'&&window.LSUMS&&p&&p.sku){
      const v=LSUMS[String(p.sku).toLowerCase()];
      if(v!==undefined)return v;
    }
  }catch(e){}
  return typeof p.stock==='number'?p.stock:null;
};
function statusOf(s){
  if(s===null) return {l:'N/A',c:'pgy'};
  if(s<0)      return {l:'Negative',c:'prd'};
  if(s===0)    return {l:'Out of stock',c:'prd'};
  if(s<10)     return {l:'Low',c:'pam'};
  return              {l:'In stock',c:'pgr'};
}
function fmtP(v){return v!=null&&v>0?'₱'+v.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';}
function fmtK(v){return v!=null&&v>0?'₱'+Math.round(v).toLocaleString('en-PH'):'—';} // full pesos everywhere — no K-rounding (per Jojo)
function expSoon(e){
  if(!e||e==='-') return false;
  const parts=e.match(/([0-9]{1,2})[\/\-]([0-9]{4})/);
  if(!parts) return false;
  return (new Date(+parts[2],+parts[1]-1,1)-new Date())/(864e5*30)<6;
}
function expDaysLeft(expStr){
  if(!expStr) return null;
  const parts=expStr.match(/([0-9]{1,2})[\/\-]([0-9]{4})/);
  if(!parts) return null;
  return Math.round((new Date(+parts[2],+parts[1]-1,1)-new Date())/864e5);
}
function expColor(days){
  if(days===null) return 'pgy';
  if(days<0) return 'prd';
  if(days<=31) return 'prd';
  if(days<=92) return 'pam';
  return 'pgr';
}
function expLabel(days){
  if(days===null) return 'No date';
  if(days<0) return 'Expired';
  if(days===0) return 'Expires today';
  if(days<=31) return days+'d left';
  if(days<=92) return Math.round(days/30.4)+'mo left';
  return Math.round(days/30.4)+'mo left';
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function isReorderAlert(p){
  const t=REORDER[p.sku];
  if(t && typeof t==='number') return stk(p)!==null && stk(p)<t; // manual threshold overrides
  return ropCalc(p).below; // else use computed reorder point
}

function mobileNav(v,el){
  document.querySelectorAll('.mni').forEach(x=>x.classList.remove('active'));
  if(el) el.classList.add('active');
  const mt=$('mptitle');
  showView(v,null);
  if(mt) mt.textContent=$('ptitle').textContent;
}
function updateMobileSync(state,label){
  const b=document.getElementById('mobileSyncBtn'),l=document.getElementById('mslbl');
  if(b) b.className='mobile-sync'+(state?' '+state:'');
  if(l&&label) l.textContent=label;
}
function updateMobileBadges(){
  const oos=DATA.filter(p=>stk(p)===0).length;
  const low=DATA.filter(p=>{const s=stk(p);return s!==null&&s>0&&s<10;}).length;
  const exp=BATCHES.filter(b=>{if(!b.expiry)return false;const d=expDaysLeft(b.expiry);return d!==null&&d<=92&&b.soh>0;}).length;
  const set=(id,v)=>{const el=document.getElementById(id);if(el){el.textContent=v;el.style.display=v>0?'':'none';}};
  set('mb-oos',oos);set('mb-low',low);set('mb-exp',exp);
  const so30=DATA.filter(p=>p.daysToStockout!=null&&p.daysToStockout>0&&p.daysToStockout<=30&&(p.velAdj||0)>0).length;
  const wo=(COLLISIONS||[]).filter(c=>c.projExpired>0).length;
  set('mb-so30',so30);set('mb-wo',wo);
}

function refreshSidebar(){
  const oos=DATA.filter(p=>stk(p)===0).length;
  const low=DATA.filter(p=>{const s=stk(p);return s!==null&&s>0&&s<10;}).length;
  const neg=DATA.filter(p=>{const s=stk(p);return s!==null&&s<0;}).length;
  const reorderCount=DATA.filter(p=>isReorderAlert(p)).length;
  // Expiry alerts from batches
  const now=new Date();
  const expAlerts=BATCHES.filter(b=>{
    if(!b.expiry) return false;
    const d=expDaysLeft(b.expiry);
    return d!==null&&d<=92&&b.soh>0;
  }).length;
  $('b-oos').textContent=oos;
  $('b-low').textContent=low;
  $('b-neg').textContent=neg;
  $('b-exp').textContent=expAlerts;
  $('b-reorder').textContent=reorderCount;
  const so30=DATA.filter(p=>p.daysToStockout!=null&&p.daysToStockout>0&&p.daysToStockout<=30&&(p.velAdj||0)>0).length;
  const woCnt=(COLLISIONS||[]).filter(c=>c.projExpired>0).length;
  if($('b-so30'))$('b-so30').textContent=so30;
  if($('b-wo'))$('b-wo').textContent=woCnt;
  const belowRop=DATA.filter(p=>stk(p)!==null&&((p.velAdj||0)>0||(p.velocity||0)>0)&&ropCalc(p).below).length;
  if($('b-rop'))$('b-rop').textContent=belowRop;
  if($('b-action'))$('b-action').textContent=belowRop;
  if($('b-health')){const hIssues=DATA.filter(p=>{const s=stk(p);const act=(s!==null&&s>0)||p.sold>0;return (s!==null&&s<0)||(act&&(!(p.price>0)||(s>0&&!p.expiry)));}).length;$('b-health').textContent=hIssues;}
  const lines=[...new Set(DATA.map(p=>p.line).filter(Boolean))].sort();
  $('lnav').innerHTML=lines.map(l=>{
    const n=DATA.filter(p=>p.line===l).length;
    const el=l.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="ni" onclick="fltLine(\''+el+'\',this)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l)+'</span><span class="nbadge m">'+n+'</span></div>';
  }).join('');
}

/* ── SYNC ── */

function applySync(data){
  DATA=data.products||DATA;
  DATA.forEach(p=>{p.dtsBaseline=dtsBaseline(p);}); // precompute for sortable All-SKUs column
  BATCHES=data.batches||[];
  MONTHLY_IN=data.monthlyIn||{};
  MONTHLY_OUT=data.monthlyOut||{};
  MONTHS=data.months||[];
  VALUE_BY_LINE=data.valueByLine||{};
  CASH_EXPIRING=data.cashExpiring||{};
  EXPIRING_ITEMS=data.expiringItems||[];
  BRANCH_TRANSFERS=data.branchTransfers||[];
  BRANCH_EXPIRY=data.branchExpirySummary||{};
  CUSTOMERS=data.customers||[];
  COLLISIONS=data.collisions||[];
  TARGETS=data.targets||[];
  try{mergeSpecTargets();}catch(e){} // in-app targets override sheet targets
  try{maybeSnapshotForecast();}catch(e){} // monthly forecast freeze for MAPE scoring
  try{applyCatalog();}catch(e){} // item-master pricing override when independent
  ACCT=data.acctBooked||null;
  if(SHOPIFY)mergeShopify(); else loadShopify();
  $('psub').textContent='Healthspan Global, Inc.';
  updateMobileBadges();
  refreshSidebar();
  if(currentView==='action') renderActionCenter();
  else if(currentView==='customers') renderCustomers();
  else if(currentView==='health') renderDataHealth();
  else if(currentView==='dashboard') renderDashboard();
  else if(currentView==='expiry') renderExpiry();
  else if(currentView==='value') renderValue();
  else if(currentView==='dealvalue') renderDealValue();
  else if(currentView==='movement') renderMovement();
  else if(currentView==='batches') renderBatches();
  else if(currentView==='aged') renderAged();
  else if(currentView==='shrinkage') renderShrinkage();
  else if(currentView==='cashexpiry') renderCashExpiry();
  else if(currentView==='branchtransfer') renderBranchTransfer();
  else if(currentView==='branchexpiry') renderBranchExpiry();
  else if(currentView==='forecast') renderForecast();
  else if(currentView==='coverage') renderCoverage();
  else if(currentView==='reorderplan') renderReorderPlan();
  else if(currentView==='ropoint') renderReorderPoint();
  else if(currentView==='variability') renderVariability();
  else if(currentView==='abc') renderABC();
  else if(currentView==='writeoff') renderWriteoff();
  else if(currentView==='whatif') renderWhatIf();
  else if(currentView==='simpromo') renderPromoSim();
  else if(currentView==='simbudget') renderBudgetSim();
  else if(currentView==='simservice') renderServiceSim();
  else if(currentView==='simsurge') renderSurgeSim();
  else if(currentView==='simmonte') renderMonteSim();
  else if(currentView==='simproject') renderProjectSim();
  else if(currentView==='simcash') renderCashSim();
  else if(currentView==='simbulk') renderBulkSim();
  else if(currentView==='simbranch') renderBranchSim();
  else if(currentView==='salesoverview') renderSalesOverview();
  else if(currentView==='salesfree') renderSalesFree();
  else if(currentView==='salestarget') renderSalesTarget();
  else if(currentView==='salesspec') renderSalesSpec();
  else if(currentView==='salesdeals') renderSalesDeals();
  else if(currentView==='salesrecon') renderSalesRecon();
  else if(currentView==='salesfield') renderSalesField();
  else if(currentView==='logvisit') renderLogVisit();
  else if(currentView==='followups') renderFollowups();
  else if(currentView==='account'){ACCTBYNORM=null;renderAccountPage();}
  else if(currentView==='neworder') renderNewOrder();
  else if(currentView==='orders') renderOrders();
  else if(currentView==='order') renderOrderPage();
  else if(currentView==='spec') renderSpecPage();
  else if(currentView==='fulfillq') renderFulfillQ();
  else if(currentView==='ar') renderAR();
  else if(currentView==='users') renderUsers();
  else if(currentView==='home') renderHome();
  else if(currentView==='audit') renderAudit();
  else if(currentView==='targets') renderTargets();
  else if(currentView==='fcastacc') renderFcastAcc();
  else if(currentView==='salespace') renderSalesPace();
  else if(currentView==='pdc') renderPDC();
  else if(currentView==='salesdue') renderSalesDue();
  else if(currentView==='catalog') renderCatalog();
  else if(currentView==='returns') renderReturns();
  else if(currentView==='scan') renderScan();
  else if(currentView==='cutover') renderCutover();
  else if(currentView==='scorecards') renderScorecards();
  else if(currentView==='recall') renderRecall();
  else if(currentView==='pipeline') renderPipeline();
  else if(currentView==='po') renderPOs();
  else if(currentView==='approvals') renderApprovals();
  else if(currentView==='commissions') renderCommissions();
  else if(currentView==='salesevents') renderEvents();
  else if(currentView==='quotes') renderQuotes();
  else if(currentView==='promos') renderPromos();
  else if(currentView==='regs') renderRegs();
  else if(currentView==='cyclecount') renderCycleCounts();
  else if(currentView==='cashflow') renderCashflow();
  else if(currentView==='campaigns') renderCampaigns();
  else if(currentView==='planreview') renderPlanReview();
  else renderTable();
  injectDesc(currentView);
  injectCalc(currentView);
}

async function syncNow(){
  // Progress helpers
  function setProgress(pct, label, activeStep){
    const prog=$('syncProgress');
    if(prog){prog.classList.add('show');}
    if($('spFill')) $('spFill').style.width=pct+'%';
    if($('spPct')) $('spPct').textContent=pct+'%';
    if($('spLabel')) $('spLabel').textContent=label;
    [1,2,3,4,5,6].forEach(i=>{
      const el=$('sps'+i);
      if(!el) return;
      el.className='sp-step'+(i<activeStep?' done':i===activeStep?' active':'');
    });
  }
  function hideProgress(){
    const prog=$('syncProgress');
    if(prog){setTimeout(()=>prog.classList.remove('show'),1500);}
  }
  setProgress(50,'Loading cached inventory data...',3);
  // Load cached data from localStorage immediately
  try {
    const cached = localStorage.getItem('hs_inv_cache_v2');
    if (cached) {
      const c = JSON.parse(cached);
      applySync(c);
      const ts = new Date(c.synced).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      $('sf-foot').innerHTML='<span style="color:var(--tx3)">Cached</span> &middot; '+ts+' &middot; <a href="#" onclick="syncNow();return false" style="color:var(--ac)">refresh</a>';
    }
  } catch(e) {}
  // Then fetch fresh
  const btn=$('syncBtn'),lbl=$('slbl');
  try{
    if(btn) btn.className='sync-btn spin';
    if(lbl) lbl.textContent='Syncing...';
    updateMobileSync('spin','Syncing...');
    setProgress(70,'Retrieving pre-processed data...',4);
    const ctrl=new AbortController();
    const tmo=setTimeout(()=>ctrl.abort(),45000);
    const r=await fetch('/.netlify/functions/refresh',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:'{}',signal:ctrl.signal});
    clearTimeout(tmo);
    if(r.status===401){ // not signed in yet — quiet state, sbLoadProfile will re-sync
      if(btn) btn.className='sync-btn';
      if(lbl) lbl.textContent='Sign in to sync';
      updateMobileSync('','Sign in to sync');
      setProgress(0,'',0);
      return;
    }
    if(!r.ok) throw new Error('Server returned '+r.status);
    setProgress(90,'Applying data...',5);
    const data=await r.json();
    if(data.error) throw new Error(data.error);
    if(!data.products||data.products.length<5) throw new Error('Too few products returned');
    setProgress(100,'Sync complete!',6);
    // Save to localStorage for instant load next time
    try { localStorage.setItem('hs_inv_cache_v2', JSON.stringify(data)); } catch(e) {}
    applySync(data);
    const ts=new Date(data.synced).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    $('sf-foot').innerHTML='<span style="color:var(--gr);font-weight:600">Live</span> &middot; Synced '+ts;
    if(btn) btn.className='sync-btn ok';
    if(lbl) lbl.textContent='Synced '+ts;
    updateMobileSync('ok','Synced '+ts);
    hideProgress();
  }catch(e){
    const msg=e.name==='AbortError'?'Timed out after 45s':(e.message||'Unknown error');
    if(btn) btn.className='sync-btn err';
    if(lbl) lbl.textContent='Sync failed \u2014 retry';
    updateMobileSync('err','Retry');
    setProgress(100,'Sync failed: '+msg.slice(0,80),6);
    hideProgress();
    const sf=$('sf-foot');
    if(sf) sf.innerHTML='<span style="color:var(--rd)">Error:</span> '+msg.slice(0,100)+' &middot; <a href="#" onclick="syncNow();return false" style="color:var(--ac)">retry</a>';
  }
}
