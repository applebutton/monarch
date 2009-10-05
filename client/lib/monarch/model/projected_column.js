constructor("Model.ProjectedColumn", {
  initialize: function(column, column_alias) {
    this.column = column;
    this.column_alias = column_alias;
  },

  name: function() {
    return this.column_alias || this.column.name;
  },

  eq: function(right_operand) {
    return new Model.Predicates.Eq(this, right_operand);
  }
});
