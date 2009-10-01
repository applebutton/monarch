class Object
  def to_sql
    inspect
  end
end

class Symbol
  def starts_with?(prefix)
    to_s.starts_with?(prefix)
  end
end

class String
  def starts_with?(prefix)
    index(prefix) == 0
  end

  def path_starts_with?(prefix)
    split('/').starts_with?(prefix.split('/'))
  end

  def to_sql
    inspect
  end
end

class Array
  def starts_with?(prefix)
    return true if prefix.empty?
    return false if prefix.size > size
    prefix.each_with_index do |element, index|
      return false unless self[index] == element
    end
    true
  end
end

class TrueClass
  def to_sql
    "t".inspect
  end
end

class FalseClass
  def to_sql
    "f".inspect
  end
end

class NilClass
  def to_sql
    "null"
  end
end

class Time
  def to_millis
    to_i * 1000
  end

  def ==(other)
    to_i == other.to_i
  end
end
