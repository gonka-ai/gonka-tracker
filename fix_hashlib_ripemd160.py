#!/usr/bin/env python3
"""
Patch hashlib to use pycryptodome's RIPEMD160
This must be imported BEFORE gonka_openai
"""

import hashlib
from Crypto.Hash import RIPEMD160 as CryptoRIPEMD160

# Monkey patch hashlib to support RIPEMD160
class RIPEMD160:
    def __init__(self, data=b''):
        self._hash = CryptoRIPEMD160.new()
        if data:
            self.update(data)
    
    def update(self, data):
        self._hash.update(data)
        return self
    
    def digest(self):
        return self._hash.digest()
    
    def hexdigest(self):
        return self._hash.hexdigest()
    
    def copy(self):
        new = RIPEMD160()
        new._hash = self._hash.copy()
        return new

# Patch hashlib
hashlib.ripemd160 = RIPEMD160
hashlib.new('ripemd160', b'')

print("✅ Patched hashlib to use pycryptodome's RIPEMD160")
