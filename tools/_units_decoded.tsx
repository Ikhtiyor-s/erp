Traceback (most recent call last):
  File "d:\Docker\projects\erp\tools\decode_corrupted.py", line 58, in <module>
    sys.exit(main(sys.argv))
  File "d:\Docker\projects\erp\tools\decode_corrupted.py", line 50, in main
    sys.stdout.write(decoded)
  File "C:\Users\Asus\AppData\Local\Programs\Python\Python310\lib\encodings\cp1251.py", line 19, in encode
    return codecs.charmap_encode(input,self.errors,encoding_table)[0]
UnicodeEncodeError: 'charmap' codec can't encode characters in position 1576-1577: character maps to <undefined>
