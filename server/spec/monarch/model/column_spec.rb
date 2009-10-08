require File.expand_path("#{File.dirname(__FILE__)}/../../monarch_spec_helper")

module Model
  describe Column do
    describe "class methods" do
      describe ".from_wire_representation" do
        it "returns a Column based on the 'table' and 'name' of the given representation" do
          column = Column.from_wire_representation({
            "type" => "column",
            "table" => "blog_posts",
            "name" => "body"
          })

          column.should == BlogPost[:body]
        end
      end
    end

    describe "instance methods" do
      describe "#to_sql" do
        it "returns the qualified column name" do
          BlogPost[:body].to_sql.should == "blog_posts.body"
        end
      end

      describe "#to_aliased_sql" do
        it "returns the qualified column name aliased to a name that includes the table name" do
          BlogPost[:body].to_aliased_sql.should == "blog_posts.body as blog_posts__body"
        end
      end

      describe "#eq" do
        it "returns an instance of Predicates::Eq with self as #left_operand and the argument as #right_operand" do
          predicate = BlogPost[:id].eq("grain_quinoa")
          predicate.class.should == Predicates::Eq
          predicate.left_operand.should == BlogPost[:id]
          predicate.right_operand.should == "grain_quinoa"
        end
      end
    end
  end
end
