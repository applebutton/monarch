//= require "../../monarch_spec_helper"

Screw.Unit(function(c) { with(c) {
  describe("Monarch.Model.Column", function() {
    useLocalFixtures();

    describe("#eq", function() {
      it("returns an Eq predicate with the Column as the #leftOperand an the argument as the #rightOperand", function() {
        var pred = Blog.id.eq('recipes');
        expect(pred.constructor).to(eq, Monarch.Model.Predicates.Eq);
        expect(pred.leftOperand).to(eq, Blog.id);
        expect(pred.rightOperand).to(eq, 'recipes');
      });
    });
  });
}});
