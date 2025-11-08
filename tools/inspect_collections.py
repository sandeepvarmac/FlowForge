import sys
print('Python:', sys.version)
import collections
print('collections module path:', getattr(collections, '__file__', 'stdlib'))
print('has abc:', hasattr(collections, 'abc'))
