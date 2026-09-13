import 'dart:convert';
import 'dart:typed_data';

import 'package:excel/excel.dart' hide Border;
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api.dart';
import '../../../core/hadir_brand.dart';
import '../../../core/hadir_time.dart';
import '../../../core/session.dart';

/// Flutter presentation of the canonical website attendance/report center.
/// The API is read-only here; attendance mutations remain on /api/attendance.
class AdminGlobalReportsPage extends StatefulWidget {
  const AdminGlobalReportsPage({super.key});

  @override
  State<AdminGlobalReportsPage> createState() => _AdminGlobalReportsPageState();
}

class _AdminGlobalReportsPageState extends State<AdminGlobalReportsPage> {
  HadirApi? _api;
  DateTime _from = DateTime(HadirTime.now().year, HadirTime.now().month, 1);
  DateTime _to = HadirTime.now();
  String _employeeId = '';
  String _status = 'ALL';
  bool _exceptionsOnly = false;
  int _tab = 0;
  bool _loading = true;
  bool _exporting = false;
  String? _error;
  List<Map<String, dynamic>> _employees = [];
  Map<String, dynamic>? _report;
  Map<String, dynamic>? _detail;

  String _date(DateTime v) => '${v.year.toString().padLeft(4, '0')}-${v.month.toString().padLeft(2, '0')}-${v.day.toString().padLeft(2, '0')}';
  int _num(Map<String, dynamic> m, String k) => m[k] is num ? (m[k] as num).toInt() : int.tryParse('${m[k]}') ?? 0;
  String _mins(dynamic v) { final n = (v is num ? v.toInt() : int.tryParse('$v') ?? 0).clamp(0, 999999); return '${n ~/ 60}س ${n % 60}د'; }
  String _statusLabel(String s) => const {'PRESENT':'حاضر','LATE':'متأخر','ABSENT':'غياب','LEAVE':'إجازة','PERMISSION':'استئذان','REST':'راحة','ESCAPED':'هروب','NOT_STARTED':'لم يبدأ','INVALID':'غير صالح','OPEN':'انصراف معلق'}[s] ?? s;
  String _clock(dynamic v) { if (v == null || '$v'.isEmpty) return '—'; final d = HadirTime.fromTimestamp(v); return d == null ? '$v' : '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}'; }

  @override
  void initState() { super.initState(); _init(); }

  Future<void> _init() async {
    try {
      final token = await HadirSession().adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final api = HadirApi(token: token);
      final response = await api.dio.get('/api/employees');
      final raw = response.data;
      final employees = raw is List ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() { _api = api; _employees = employees; _loading = false; });
      await _loadReport();
    } catch (e) { if (mounted) setState(() { _loading = false; _error = HadirApi.errorMessage(e); }); }
  }

  Future<void> _loadReport() async {
    final api = _api;
    if (api == null) return;
    if (_from.isAfter(_to)) { setState(() => _error = 'حدد فترة زمنية صحيحة.'); return; }
    setState(() { _loading = true; _error = null; _detail = null; });
    try {
      final result = await api.professionalAttendanceReport(from: _date(_from), to: _date(_to), employeeId: _employeeId.isEmpty ? null : _employeeId);
      if (mounted) setState(() { _report = result; _loading = false; });
    } catch (e) { if (mounted) setState(() { _loading = false; _error = HadirApi.errorMessage(e); }); }
  }

  Future<void> _detailFor(Map<String, dynamic> row) async {
    final api = _api; final day = '${row['attendanceDay'] ?? ''}'; final id = '${row['employeeId'] ?? ''}';
    if (api == null || day.isEmpty || id.isEmpty) return;
    setState(() { _detail = null; _loading = true; });
    try { final detail = await api.professionalAttendanceDrilldown(attendanceDay: day, employeeId: id); if (mounted) setState(() { _detail = detail; _loading = false; }); }
    catch (e) { if (mounted) setState(() { _loading = false; _error = HadirApi.errorMessage(e); }); }
  }

  List<Map<String, dynamic>> get _rows {
    final raw = _report?['rows']; if (raw is! List) return [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).where((r) {
      final s = '${r['status'] ?? ''}'; if (_status != 'ALL' && s != _status) return false;
      if (_exceptionsOnly && !(['LATE','ABSENT','ESCAPED','OPEN'].contains(s) || _num(r, 'lateMinutes') > 0 || _num(r, 'earlyLeaveMinutes') > 0)) return false;
      return true;
    }).toList();
  }

  List<Map<String, dynamic>> get _summaries {
    final a = _report?['analytics']; final raw = a is Map ? a['employeeSummaries'] : null;
    return raw is List ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : [];
  }

  List<Map<String, dynamic>> get _exceptions {
    final a = _report?['analytics']; final raw = a is Map ? a['exceptions'] : null;
    return raw is List ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : [];
  }

  Map<String, dynamic> get _summary => _report?['summary'] is Map ? Map<String, dynamic>.from(_report!['summary'] as Map) : {};

  void _period(String p) {
    final n = HadirTime.now();
    setState(() { if (p == 'today') { _from = DateTime(n.year,n.month,n.day); _to = _from; } else if (p == 'week') { final s = n.subtract(Duration(days:n.weekday-1)); _from=DateTime(s.year,s.month,s.day); _to=DateTime(n.year,n.month,n.day); } else if (p == 'year') { _from=DateTime(n.year,1,1); _to=DateTime(n.year,n.month,n.day); } else { _from=DateTime(n.year,n.month,1); _to=DateTime(n.year,n.month,n.day); } }); _loadReport();
  }

  Future<void> _pick(bool from) async { final d = await showDatePicker(context: context, initialDate: from ? _from : _to, firstDate: DateTime(2020), lastDate: HadirTime.now().add(const Duration(days:365)), locale: const Locale('ar')); if (d == null) return; setState(() { if(from) _from=d; else _to=d; }); }

  Future<void> _shareCsv() async {
    final rows = _rows; if (rows.isEmpty) return; setState(() => _exporting=true);
    try { final b=StringBuffer(); b.writeln('التاريخ,الموظف,الرقم الوظيفي,الحالة,الحضور,الانصراف,الساعات,التأخر,المبكر,الإضافي,الاستثناء'); for(final r in rows){ String q(dynamic v)=>'"${'${v ?? ''}'.replaceAll('"','""')}"'; b.writeln([r['attendanceDay'],r['employeeName'],r['jobNumber'],_statusLabel('${r['status'] ?? ''}'),_clock(r['checkInAt']),_clock(r['checkOutAt']),_mins(r['workedMinutes']),r['lateMinutes']??0,r['earlyLeaveMinutes']??0,r['overtimeMinutes']??0,r['exceptionCode']??''].map(q).join(',')); } await SharePlus.instance.share(ShareParams(files:[XFile.fromData(Uint8List.fromList(utf8.encode(b.toString())),mimeType:'text/csv',name:'hadir-attendance.csv')],text:'تقرير حاضر ${_date(_from)} → ${_date(_to)}')); } finally { if(mounted) setState(()=>_exporting=false); }
  }

  Future<void> _shareExcel() async {
    final rows=_rows; if(rows.isEmpty)return; setState(()=>_exporting=true);
    try { final excel=Excel.createExcel(); final sheet=excel['تقرير الحضور']; final headers=['التاريخ','الموظف','الرقم الوظيفي','الحالة','الحضور','الانصراف','الساعات','التأخر','المبكر','الإضافي','الاستثناء']; for(var c=0;c<headers.length;c++){sheet.cell(CellIndex.indexByColumnRow(columnIndex:c,rowIndex:0)).value=TextCellValue(headers[c]);} for(var r=0;r<rows.length;r++){final x=rows[r]; final values=['${x['attendanceDay']??''}','${x['employeeName']??''}','${x['jobNumber']??''}',_statusLabel('${x['status']??''}'),_clock(x['checkInAt']),_clock(x['checkOutAt']),_mins(x['workedMinutes']),'${x['lateMinutes']??0}','${x['earlyLeaveMinutes']??0}','${x['overtimeMinutes']??0}','${x['exceptionCode']??''}']; for(var c=0;c<values.length;c++){sheet.cell(CellIndex.indexByColumnRow(columnIndex:c,rowIndex:r+1)).value=TextCellValue(values[c]);}} final bytes=excel.encode(); if(bytes==null)throw Exception('تعذر إنشاء Excel.'); await SharePlus.instance.share(ShareParams(files:[XFile.fromData(Uint8List.fromList(bytes),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',name:'hadir-attendance.xlsx')],text:'تقرير حاضر')); } finally {if(mounted)setState(()=>_exporting=false);}
  }

  Future<void> _print() async {
    final rows=_rows; if(rows.isEmpty)return; setState(()=>_exporting=true);
    try { final regular=await PdfGoogleFonts.notoSansArabicRegular(); final bold=await PdfGoogleFonts.notoSansArabicBold(); final pdf=pw.Document(); final data=rows.map((r)=><String>['${r['attendanceDay']??'—'}','${r['employeeName']??'—'}','${r['jobNumber']??'—'}',_statusLabel('${r['status']??''}'),_clock(r['checkInAt']),_clock(r['checkOutAt']),_mins(r['workedMinutes']),'${r['lateMinutes']??0}','${r['earlyLeaveMinutes']??0}','${r['overtimeMinutes']??0}']).toList(); pdf.addPage(pw.MultiPage(pageFormat:PdfPageFormat.a4.landscape,textDirection:pw.TextDirection.rtl,build:(c)=>[pw.Text('HADIR / حاضر · تقرير الحضور',style:pw.TextStyle(font:bold,fontSize:18)),pw.SizedBox(height:8),pw.Text('${_date(_from)} → ${_date(_to)}',style:pw.TextStyle(font:regular,fontSize:10)),pw.SizedBox(height:12),pw.TableHelper.fromTextArray(data:data,headers:const['التاريخ','الموظف','الرقم الوظيفي','الحالة','الحضور','الانصراف','الساعات','التأخر','المبكر','الإضافي'],headerStyle:pw.TextStyle(font:bold,fontSize:7),cellStyle:pw.TextStyle(font:regular,fontSize:7),tableDirection:pw.TextDirection.rtl)])); await Printing.layoutPdf(name:'hadir-report-${_date(_from)}-${_date(_to)}.pdf',onLayout:(_)=>pdf.save()); } finally {if(mounted)setState(()=>_exporting=false);}
  }

  @override
  Widget build(BuildContext context) {
    final rows=_rows; final s=_summary;
    return Directionality(textDirection:TextDirection.rtl,child:Scaffold(appBar:AppBar(title:const Text('مركز التقارير والحضور',style:TextStyle(fontWeight:FontWeight.w900)),actions:[IconButton(onPressed:_exporting||rows.isEmpty?null:_print,tooltip:'PDF / طباعة',icon:const Icon(Icons.print_outlined)),PopupMenuButton<String>(enabled:!_exporting&&rows.isNotEmpty,onSelected:(v)=>v=='excel'?_shareExcel():_shareCsv(),itemBuilder:(_)=>const[PopupMenuItem(value:'excel',child:Text('تصدير Excel')),PopupMenuItem(value:'csv',child:Text('تصدير CSV'))]),IconButton(onPressed:_loading?null:_loadReport,tooltip:'تحديث',icon:const Icon(Icons.refresh_rounded))]),body:RefreshIndicator(onRefresh:_loadReport,child:ListView(padding:const EdgeInsets.fromLTRB(16,10,16,30),children:[_hero(),const SizedBox(height:12),_filters(),if(_error!=null)...[const SizedBox(height:10),_errorCard()],if(_report!=null)...[const SizedBox(height:14),_kpis(s),const SizedBox(height:14),_tabs(),const SizedBox(height:12),_tabBody(rows,s),if(_detail!=null)_detailCard(_detail!)]]))));
  }

  Widget _hero()=>Container(padding:const EdgeInsets.all(18),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(20),border:Border.all(color:HadirBrand.border),boxShadow:const[BoxShadow(color:Color(0x12000000),blurRadius:14,offset:Offset(0,5))]),child:Row(children:[Container(width:44,height:44,decoration:BoxDecoration(color:HadirBrand.soft,borderRadius:BorderRadius.circular(13)),child:const Icon(Icons.analytics_rounded,color:HadirBrand.primary,size:23)),const SizedBox(width:12),const Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('HADIR · ATTENDANCE CENTER',style:TextStyle(color:HadirBrand.muted,fontSize:10,fontWeight:FontWeight.w800)),SizedBox(height:2),Text('مركز التقارير والحضور',style:TextStyle(fontSize:22,fontWeight:FontWeight.w900)),SizedBox(height:4),Text('المصدر الموحد للسجل الرسمي، المؤشرات، الساعات، الموظفين والاستثناءات. القراءة فقط؛ الحضور يبقى عبر محرك الحضور المركزي.',style:TextStyle(color:HadirBrand.muted,fontSize:11,height:1.4))]))]);

  Widget _filters()=>Card(child:Padding(padding:const EdgeInsets.all(14),child:Column(children:[Align(alignment:Alignment.centerRight,child:Wrap(spacing:7,children:[_chip('يومي','today'),_chip('أسبوعي','week'),_chip('شهري','month'),_chip('سنوي','year')])),const SizedBox(height:10),Row(children:[Expanded(child:_dateButton('من',_from,true)),const SizedBox(width:8),Expanded(child:_dateButton('إلى',_to,false))]),const SizedBox(height:10),DropdownButtonFormField<String>(value:_employeeId.isEmpty?null:_employeeId,decoration:const InputDecoration(labelText:'الموظف',prefixIcon:Icon(Icons.person_outline)),items:[const DropdownMenuItem(value:'',child:Text('كل الموظفين')),..._employees.map((e)=>DropdownMenuItem(value:'${e['id']}',child:Text('${e['name']??'موظف'} · ${e['jobNumber']??'—'}')))],onChanged:(v){setState(()=>_employeeId=v??'');}),const SizedBox(height:10),Row(children:[Expanded(child:DropdownButtonFormField<String>(value:_status,decoration:const InputDecoration(labelText:'الحالة'),items:const[DropdownMenuItem(value:'ALL',child:Text('كل الحالات')),DropdownMenuItem(value:'PRESENT',child:Text('حاضر')),DropdownMenuItem(value:'LATE',child:Text('متأخر')),DropdownMenuItem(value:'ABSENT',child:Text('غياب')),DropdownMenuItem(value:'LEAVE',child:Text('إجازة')),DropdownMenuItem(value:'PERMISSION',child:Text('استئذان')),DropdownMenuItem(value:'REST',child:Text('راحة')),DropdownMenuItem(value:'ESCAPED',child:Text('هروب')),DropdownMenuItem(value:'OPEN',child:Text('انصراف معلق')),DropdownMenuItem(value:'INVALID',child:Text('غير صالح'))],onChanged:(v)=>setState(()=>_status=v??'ALL'))),const SizedBox(width:8),Expanded(child:SwitchListTile.adaptive(contentPadding:EdgeInsets.zero,value:_exceptionsOnly,onChanged:(v)=>setState(()=>_exceptionsOnly=v),title:const Text('الاستثناءات فقط',style:TextStyle(fontSize:12,fontWeight:FontWeight.w800))))]),const SizedBox(height:8),FilledButton.icon(onPressed:_loading?null:_loadReport,icon:_loading?const SizedBox.square(dimension:18,child:CircularProgressIndicator(strokeWidth:2,color:Colors.white)):const Icon(Icons.sync_rounded),label:Text(_loading?'جاري بناء التقرير…':'تحديث مركز التقارير'))])));

  Widget _dateButton(String label,DateTime value,bool from)=>OutlinedButton.icon(onPressed:()=>_pick(from),icon:const Icon(Icons.calendar_today_outlined,size:17),label:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(label,style:const TextStyle(fontSize:10)),Text(_date(value),style:const TextStyle(fontWeight:FontWeight.w800))]));
  Widget _chip(String label,String p)=>ActionChip(label:Text(label),onPressed:()=>_period(p));
  Widget _kpis(Map<String,dynamic> s)=>GridView.count(shrinkWrap:true,physics:const NeverScrollableScrollPhysics(),crossAxisCount:2,childAspectRatio:1.55,crossAxisSpacing:8,mainAxisSpacing:8,children:[_Kpi('الموظفون','${_num(s,'employees')}','${_num(s,'employeeDays')} موظف/يوم',Icons.groups_rounded),_Kpi('الحضور','${_num(s,'present')+_num(s,'late')}','معدل ${s['attendanceRate']??0}%',Icons.how_to_reg_rounded),_Kpi('الساعات',_mins(s['workedMinutes']),'متوقع ${_mins(s['expectedMinutes'])}',Icons.schedule_rounded),_Kpi('الاستثناءات','${_exceptions.length}','تأخر ${_num(s,'lateMinutes')}د · إضافي ${_num(s,'overtimeMinutes')}د',Icons.warning_amber_rounded)]);
  Widget _tabs()=>SingleChildScrollView(scrollDirection:Axis.horizontal,child:Row(children:[_tabButton(0,'النظرة التنفيذية',Icons.dashboard_outlined),_tabButton(1,'السجل اليومي',Icons.fact_check_outlined),_tabButton(2,'الموظفون',Icons.groups_outlined),_tabButton(3,'الاستثناءات',Icons.warning_amber_outlined)]));
  Widget _tabButton(int i,String label,IconData icon){final active=_tab==i;return Padding(padding:const EdgeInsets.only(left:7),child:ChoiceChip(selected:active,label:Row(mainAxisSize:MainAxisSize.min,children:[Icon(icon,size:16),const SizedBox(width:5),Text(label)]),onSelected:(_)=>setState(()=>_tab=i))));}

  Widget _tabBody(List<Map<String,dynamic>> rows,Map<String,dynamic> s){
    if(_tab==0)return _overview(s);
    if(_tab==2)return _employeeTab();
    if(_tab==3)return _exceptionTab();
    return _dailyTab(rows);
  }

  Widget _overview(Map<String,dynamic> s){
    final daily=(_report?['analytics'] is Map)?(_report!['analytics']['dailySeries'] is List?_report!['analytics']['dailySeries'] as List:const[]):const[];
    final max=daily.fold<int>(1,(m,e)=>e is Map?((e['expectedMinutes'] is num?(e['expectedMinutes'] as num).toInt():0)>m?(e['expectedMinutes'] as num).toInt():m):m);
    return Column(children:[Card(child:Padding(padding:const EdgeInsets.all(15),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('اتجاه الحضور والغياب',style:TextStyle(fontWeight:FontWeight.w900,fontSize:16)),const SizedBox(height:12),if(daily.isEmpty)const Text('لا توجد سلسلة يومية للفترة الحالية.') else SizedBox(height:170,child:Row(crossAxisAlignment:CrossAxisAlignment.end,children:daily.take(31).map<Widget>((e){final x=e is Map?Map<String,dynamic>.from(e):{};final present=_num(x,'present');final late=_num(x,'late');final absent=_num(x,'absent');final total=(present+late+absent).clamp(1,999999);return Expanded(child:Padding(padding:const EdgeInsets.symmetric(horizontal:2),child:Column(mainAxisAlignment:MainAxisAlignment.end,children:[Expanded(child:Align(alignment:Alignment.bottomCenter,child:Container(height:(present/total)*115+4,width:10,decoration:BoxDecoration(color:HadirBrand.primary,borderRadius:BorderRadius.circular(5))))),Text('${'${x['attendanceDay']??''}'.split('-').last}',style:const TextStyle(fontSize:8)),Text('$present/${late}/${absent}',style:const TextStyle(fontSize:7,color:HadirBrand.muted))])));} ).toList())])),),const SizedBox(height:10),Card(child:Padding(padding:const EdgeInsets.all(15),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('الساعات الفعلية مقابل المتوقعة',style:TextStyle(fontWeight:FontWeight.w900,fontSize:16)),const SizedBox(height:10),...daily.take(10).map((e){final x=e is Map?Map<String,dynamic>.from(e):{};final worked=_num(x,'workedMinutes');final expected=_num(x,'expectedMinutes');return Padding(padding:const EdgeInsets.only(bottom:8),child:Row(children:[SizedBox(width:76,child:Text('${x['attendanceDay']??''}',style:const TextStyle(fontSize:9))),Expanded(child:Column(children:[LinearProgressIndicator(value:max==0?0:(expected/max).clamp(0,1),minHeight:5)),const SizedBox(height:3),LinearProgressIndicator(value:max==0?0:(worked/max).clamp(0,1),minHeight:5)])),const SizedBox(width:8),Text(_mins(worked),style:const TextStyle(fontSize:10,fontWeight:FontWeight.w800))]));})]))));
  }

  Widget _dailyTab(List<Map<String,dynamic>> rows)=>Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('السجل اليومي الرسمي · ${rows.length} سجل',style:const TextStyle(fontWeight:FontWeight.w900,fontSize:17)),const SizedBox(height:8),if(rows.isEmpty)const Card(child:Padding(padding:EdgeInsets.all(24),child:Center(child:Text('لا توجد بيانات مطابقة للفلاتر الحالية.')))),...rows.take(250).map(_rowCard),if(rows.length>250)const Padding(padding:EdgeInsets.all(8),child:Text('الواجهة تعرض أول 250 سجلًا؛ التصدير يشمل جميع النتائج.',style:TextStyle(color:HadirBrand.muted,fontSize:10)))]);
  Widget _rowCard(Map<String,dynamic> r)=>Card(child:ListTile(onTap:()=>_detailFor(r),leading:CircleAvatar(backgroundColor:HadirBrand.soft,child:Icon('${r['status']??''}'=='ABSENT'?Icons.event_busy_rounded:Icons.event_available_rounded,color:HadirBrand.primary)),title:Text('${r['employeeName']??'موظف'}',style:const TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('${r['attendanceDay']??'—'} · ${r['jobNumber']??'—'}\n${_statusLabel('${r['status']??''}')} · ${_clock(r['checkInAt'])} → ${_clock(r['checkOutAt'])} · ${_mins(r['workedMinutes'])}'),isThreeLine:true,trailing:const Icon(Icons.chevron_left_rounded)));

  Widget _employeeTab()=>Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('ملخص الموظفين',style:TextStyle(fontWeight:FontWeight.w900,fontSize:17)),const SizedBox(height:8),..._summaries.map((e)=>Card(child:ListTile(leading:CircleAvatar(backgroundColor:HadirBrand.soft,child:const Icon(Icons.person_outline)),title:Text('${e['employeeName']??'موظف'}',style:const TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('${e['jobNumber']??'—'} · أيام ${e['days']??0} · حاضر ${e['present']??0} · غياب ${e['absent']??0}\nتأخر ${e['lateMinutes']??0}د · مبكر ${e['earlyLeaveMinutes']??0}د · إضافي ${e['overtimeMinutes']??0}د'),isThreeLine:true)))]);
  Widget _exceptionTab()=>Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('الاستثناءات · ${_exceptions.length}',style:const TextStyle(fontWeight:FontWeight.w900,fontSize:17)),const SizedBox(height:8),if(_exceptions.isEmpty)const Card(child:Padding(padding:EdgeInsets.all(24),child:Center(child:Text('لا توجد استثناءات للفترة.')))),..._exceptions.map((e)=>Card(child:ListTile(leading:const Icon(Icons.warning_amber_rounded),title:Text('${e['employeeName']??'موظف'}',style:const TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('${e['attendanceDay']??'—'} · ${e['code']??e['exceptionCode']??'استثناء'}\n${e['status']??'معلق'} · ${e['reason']??''}'),isThreeLine:true)))]);

  Widget _detailCard(Map<String,dynamic> detail){final f=detail['fact'] is Map?Map<String,dynamic>.from(detail['fact']):{};final t=detail['trace'] is Map?Map<String,dynamic>.from(detail['trace']):{};final sources=detail['sources'] is Map?Map<String,dynamic>.from(detail['sources']):{};return Card(margin:const EdgeInsets.only(top:10),child:Padding(padding:const EdgeInsets.all(15),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(children:[const Icon(Icons.manage_search_rounded,color:HadirBrand.primary),const SizedBox(width:7),Expanded(child:Text('تفصيل ${f['employeeName']??''} · ${f['attendanceDay']??''}',style:const TextStyle(fontWeight:FontWeight.w900,fontSize:16)))]),const Divider(height:22),_line('الحالة',_statusLabel('${f['status']??'—'}')),_line('الجدول','${f['scheduleType']??'—'} · ${f['scheduledStart']??'—'} → ${f['scheduledEnd']??'—'}'),_line('العمل',_mins(f['workedMinutes'])),_line('التأخر / المبكر / الإضافي','${f['lateMinutes']??0}د / ${f['earlyLeaveMinutes']??0}د / ${f['overtimeMinutes']??0}د'),_line('مصدر الحساب','${f['calculationSource']??t['sourceOfTruth']??'—'}'),_line('الإصدار','${f['calculationVersion']??'—'}'),_line('التتبع','حضور ${t['attendanceEventIds'] is List?(t['attendanceEventIds'] as List).length:0} · طلبات ${t['requestIds'] is List?(t['requestIds'] as List).length:0} · تدقيق ${t['auditIds'] is List?(t['auditIds'] as List).length:0} · استثناءات ${sources['exceptions'] is List?(sources['exceptions'] as List).length:0}'),const SizedBox(height:5),const Text('قراءة فقط — لا يتم تعديل السجل الخام من مركز التقارير.',style:TextStyle(color:HadirBrand.muted,fontSize:10))])));
  Widget _line(String a,String b)=>Padding(padding:const EdgeInsets.only(bottom:7),child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[SizedBox(width:125,child:Text(a,style:const TextStyle(color:HadirBrand.muted,fontSize:11))),Expanded(child:Text(b,style:const TextStyle(fontWeight:FontWeight.w700,fontSize:11)))]));
  Widget _errorCard()=>Card(child:Padding(padding:const EdgeInsets.all(14),child:Text(_error!,style:const TextStyle(color:HadirBrand.danger)));
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.title,this.value,this.detail,this.icon);
  final String title,value,detail; final IconData icon;
  @override Widget build(BuildContext context)=>Container(padding:const EdgeInsets.all(13),decoration:BoxDecoration(color:Theme.of(context).colorScheme.surface,borderRadius:BorderRadius.circular(HadirBrand.radiusMd),border:Border.all(color:Theme.of(context).dividerColor)),child:Row(children:[Container(width:38,height:38,decoration:BoxDecoration(color:HadirBrand.soft,borderRadius:BorderRadius.circular(11)),child:Icon(icon,color:HadirBrand.primary,size:19)),const SizedBox(width:9),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,mainAxisAlignment:MainAxisAlignment.center,children:[Text(title,style:const TextStyle(color:HadirBrand.muted,fontSize:10)),const SizedBox(height:2),Text(value,style:const TextStyle(fontSize:20,fontWeight:FontWeight.w900)),Text(detail,maxLines:1,overflow:TextOverflow.ellipsis,style:const TextStyle(color:HadirBrand.muted,fontSize:8))]))]));
}
