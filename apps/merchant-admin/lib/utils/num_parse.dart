num parseNum(dynamic v) => v is num ? v : num.tryParse(v?.toString() ?? '') ?? 0;
