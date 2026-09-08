import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

const _landingPrimary = Color(0xFF0B6B5A);
const _landingInk = Color(0xFF142D27);
const _landingMuted = Color(0xFF73827E);
const _landingBorder = Color(0xFFDCE6E2);
const _landingSurface = Color(0xFFFFFFFF);
const _landingSecondary = Color(0xFFF4F7F6);

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _landingSecondary,
      body: Stack(
        children: [
          Positioned(
            top: -100,
            left: -80,
            child: _glow(260, _landingPrimary.withValues(alpha: .09)),
          ),
          Positioned(
            bottom: -130,
            right: -90,
            child: _glow(300, _landingPrimary.withValues(alpha: .06)),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _header(),
                      const SizedBox(height: 18),
                      LayoutBuilder(
                        builder: (context, constraints) {
                          if (constraints.maxWidth < 620) {
                            return Column(
                              children: [
                                _heroCard(context),
                                const SizedBox(height: 12),
                                _securityCard(),
                              ],
                            );
                          }
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(flex: 3, child: _heroCard(context)),
                              const SizedBox(width: 12),
                              Expanded(flex: 2, child: _securityCard()),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      _metrics(),
                      const SizedBox(height: 12),
                      _flowCard(),
                      const SizedBox(height: 22),
                      const Text(
                        'Developed by AbuNizar963',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: _landingMuted, fontSize: 10.5),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _header() => Row(
        children: [
          const Expanded(child: _Brand()),
          if (MediaQuery.sizeOf(_contextForHeader) > 0) const SizedBox.shrink(),
        ],
      );

  BuildContext get _contextForHeader => _LandingContextHolder.context;

  Widget _heroCard(BuildContext context) => _HudCard(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _landingPrimary.withValues(alpha: .10),
                borderRadius: BorderRadius.circular(30),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 6,
                    height: 6,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: _landingPrimary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  SizedBox(width: 7),
                  Text(
                    'جاهز للاستخدام',
                    style: TextStyle(
                      color: _landingPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 17),
            const Text(
              'حضور وانصراف موثّق\nمن الجهاز الصحيح، وفي المكان الصحيح.',
              style: TextStyle(
                color: _landingInk,
                fontSize: 27,
                height: 1.22,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'نظام إلكتروني يمنع الغش عبر ربط كل حساب بجهاز واحد، والتحقق من الموقع الجغرافي داخل نطاق مقر العمل، مع رمز QR ثابت وسجل تدقيق غير قابل للتعديل.',
              style: TextStyle(
                color: _landingMuted,
                fontSize: 12.5,
                height: 1.65,
              ),
            ),
            const SizedBox(height: 22),
            Wrap(
              spacing: 9,
              runSpacing: 9,
              children: [
                FilledButton.icon(
                  onPressed: () => context.go('/employee-login'),
                  style: FilledButton.styleFrom(
                    backgroundColor: _landingPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                  ),
                  icon: const Icon(Icons.arrow_back_rounded, size: 17),
                  label: const Text('دخول الموظفين'),
                ),
                OutlinedButton(
                  onPressed: () => context.go('/admin-login'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _landingInk,
                    side: const BorderSide(color: _landingBorder),
                    backgroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                  ),
                  child: const Text('لوحة المدير'),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _securityCard() => _HudCard(
        padding: const EdgeInsets.all(17),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'STATUS · طبقات التحقق',
              style: TextStyle(color: _landingMuted, fontSize: 10.5, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            const _Layer(index: '01', title: 'ربط الحساب بالجهاز', desc: 'لا يمكن تسجيل حضور موظف من هاتف زميله.'),
            const SizedBox(height: 7),
            const _Layer(index: '02', title: 'التحقق من الموقع (GPS)', desc: 'داخل النطاق المسموح حول مقر العمل فقط.'),
            const SizedBox(height: 7),
            const _Layer(index: '03', title: 'رمز QR ثابت داخل الموقع', desc: 'لا يعمل QR وحده — يُستخدم مع باقي الطبقات.'),
            const SizedBox(height: 7),
            const _Layer(index: '04', title: 'سجل تدقيق دائم', desc: 'كل عملية ناجحة أو مرفوضة تُسجّل.'),
          ],
        ),
      );

  Widget _metrics() => LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 520;
          final children = [
            const _Metric(label: 'سرعة العملية', value: '< 5 ث', hint: 'من فتح الرابط حتى تأكيد الحضور'),
            const _Metric(label: 'دقة الموقع', value: '~10 م', hint: 'عبر GPS عالي الدقة في المتصفح'),
            const _Metric(label: 'طبقات الحماية', value: '4', hint: 'جهاز · موقع · QR · سجل'),
          ];
          if (compact) {
            return Column(children: [children[0], const SizedBox(height: 8), children[1], const SizedBox(height: 8), children[2]]);
          }
          return Row(children: [
            Expanded(child: children[0]),
            const SizedBox(width: 9),
            Expanded(child: children[1]),
            const SizedBox(width: 9),
            Expanded(child: children[2]),
          ]);
        },
      );

  Widget _flowCard() => _HudCard(
        padding: const EdgeInsets.all(17),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'FLOW · تسلسل التحقق',
              style: TextStyle(color: _landingMuted, fontSize: 10.5, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final items = const [
                  'تسجيل الدخول',
                  'التحقق من الجهاز',
                  'الحصول على GPS',
                  'التأكد من النطاق',
                  'مسح QR الثابت',
                  'تسجيل العملية',
                ];
                final columns = constraints.maxWidth < 520 ? 2 : 3;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: items.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 7,
                    mainAxisSpacing: 7,
                    childAspectRatio: columns == 2 ? 2.35 : 2.7,
                  ),
                  itemBuilder: (_, index) => Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _landingSecondary,
                      borderRadius: BorderRadius.circular(11),
                      border: Border.all(color: _landingBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('STEP ${('${index + 1}').padLeft(2, '0')}', style: const TextStyle(color: _landingPrimary, fontSize: 8.5, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 3),
                        Text(items[index], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _landingInk, fontSize: 10.5, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      );

  Widget _glow(double size, Color color) => Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, color: color));
}

class _LandingContextHolder {
  static BuildContext get context => throw StateError('not used');
}

class _Brand extends StatelessWidget {
  const _Brand();
  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 47,
            height: 47,
            decoration: BoxDecoration(
              gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_landingPrimary, Color(0xFF064B40)]),
              borderRadius: BorderRadius.circular(15),
              boxShadow: const [BoxShadow(color: Color(0x220B6B5A), blurRadius: 18, offset: Offset(0, 8))],
            ),
            child: const Icon(Icons.how_to_reg_rounded, color: Colors.white, size: 25),
          ),
          const SizedBox(width: 11),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('حاضر', style: TextStyle(color: _landingInk, fontSize: 23, fontWeight: FontWeight.w900)),
              Text('نظام حضور وانصراف موثّق', style: TextStyle(color: _landingMuted, fontSize: 9.5, fontWeight: FontWeight.w600)),
            ],
          ),
          const Spacer(),
          if (MediaQuery.sizeOf(context).width >= 520)
            const Text('نظام آمن · مبني على التحقق متعدد الطبقات', style: TextStyle(color: _landingMuted, fontSize: 9.5)),
        ],
      );
}

class _HudCard extends StatelessWidget {
  const _HudCard({required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(
          color: _landingSurface.withValues(alpha: .94),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _landingBorder),
          boxShadow: const [BoxShadow(color: Color(0x0D142D27), blurRadius: 24, offset: Offset(0, 10))],
        ),
        child: child,
      );
}

class _Layer extends StatelessWidget {
  const _Layer({required this.index, required this.title, required this.desc});
  final String index;
  final String title;
  final String desc;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: _landingSecondary, borderRadius: BorderRadius.circular(12), border: Border.all(color: _landingBorder)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(index, style: const TextStyle(color: _landingPrimary, fontSize: 9.5, fontWeight: FontWeight.w900)),
          const SizedBox(width: 9),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: _landingInk, fontSize: 11, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(desc, style: const TextStyle(color: _landingMuted, fontSize: 9.2, height: 1.35)),
          ])),
        ]),
      );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, required this.hint});
  final String label;
  final String value;
  final String hint;
  @override
  Widget build(BuildContext context) => _HudCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: _landingMuted, fontSize: 9.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(color: _landingInk, fontSize: 24, fontWeight: FontWeight.w900)),
          Text(hint, style: const TextStyle(color: _landingMuted, fontSize: 9.2)),
        ]),
      );
}
