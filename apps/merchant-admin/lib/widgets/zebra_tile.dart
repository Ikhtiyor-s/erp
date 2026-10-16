import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ZebraTile extends StatelessWidget {
  final int index;
  final Widget child;

  const ZebraTile({super.key, required this.index, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: index.isEven ? Colors.white : BrandColors.zebraStripe,
      child: child,
    );
  }
}
