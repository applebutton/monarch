(function(Monarch) {

_.constructor("Monarch.Model.ProjectedColumn", {
  initialize: function(column, columnAlias) {
    this.column = column;
    this.columnAlias = columnAlias;
  },

  name: function() {
    return this.columnAlias || this.column.name;
  },

  eq: function(rightOperand) {
    return new Monarch.Model.Predicates.Eq(this, rightOperand);
  },

  asc: function() {
    return new Monarch.Model.SortSpecification(this, 'asc');
  },

  desc: function() {
    return new Monarch.Model.SortSpecification(this, 'desc');
  }
});

})(Monarch);
