def binary_analysis(file):
    with open(file,'rb') as f:
        b=f.read()
        s=b.decode()
    
    return s

print(binary_analysis('app.py'))