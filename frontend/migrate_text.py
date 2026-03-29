import os, glob

comps_path = r'C:\Users\saipr\Desktop\VoiceTrace\frontend\app\components\*\*.js'
for filepath in glob.glob(comps_path):
    if 'AppText.js' in filepath: continue
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    if '<Text' not in code and '<Text>' not in code: continue

    dir_name = os.path.basename(os.path.dirname(filepath))
    rel_path = '../core/AppText' if dir_name != 'core' else './AppText'

    import_statement = f"import AppText from '{rel_path}';"
    if 'import AppText from' not in code:
        parts = code.split('\n')
        for i, line in enumerate(parts):
            if line.startswith('import ') and 'react' in line.lower():
                parts.insert(i + 1, import_statement)
                break
        code = '\n'.join(parts)

    code = code.replace('<Text ', '<AppText ')
    code = code.replace('<Text>', '<AppText>')
    code = code.replace('</Text>', '</AppText>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
        
print('Replaced React Native Text tags with AppText globally!')
