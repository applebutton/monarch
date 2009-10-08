require File.expand_path("#{File.dirname(__FILE__)}/../../../monarch_spec_helper")

module Model
  module Relations
    describe Table do

      attr_reader :table
      before do
        @table = BlogPost.table
      end

      describe "#initialize" do
        it "automatically has a string-valued :id column" do
          table.columns_by_name[:id].type.should == :string
        end
      end

      describe "#define_column" do
        it "adds a Column with the given name and type and self as its #table to the #columns_by_name hash" do
          column = table.columns_by_name[:body]
          column.name.should == :body
          column.type.should == :string
        end
      end

      describe "#columns" do
        it "returns the #values of #columns_by_name" do
          table.columns.should == table.columns_by_name.values
        end
      end

      describe "#insert" do
        it "calls Origin.insert with the Table and #field_values_by_column_name" do
          record = BlogPost.new(:body => "Brown Rice", :blog_id => "grain")
          mock(Origin).insert(table, record.field_values_by_column_name)
          table.insert(record)
        end
      end

      describe "#create" do
        it "instantiates an instance of #record_class with the given columns, #inserts it, and returns it in a non-dirty state" do
          mock(table).insert(anything) do |record|
            record.class.should == table.record_class
            record.body.should == "Brown Rice"
            record.blog_id.should == "grain"
          end

          record = table.create(:body => "Brown Rice", :blog_id => "grain")
          record.body.should == "Brown Rice"
          record.should_not be_dirty
        end

        context "if the #record_class defines a #before_create hook" do
          it "calls the after inserting the record" do
            mock.instance_of(BlogPost).before_create
            table.create(:body => "Couscous")
          end
        end

        context "if the #record_class defines an #after_create hook" do
          it "calls the after inserting the record" do
            mock.instance_of(BlogPost).after_create
            table.create(:body => "Couscous")
          end
        end
      end

      describe "#records" do
        it "executes a select all SQL query against the database and returns Records corresponding to its results" do
          record_1_id = table.create(:body => "Quinoa", :blog_id => "grain").id
          record_2_id = table.create(:body => "White Rice", :blog_id => "grain").id
          record_3_id = table.create(:body => "Pearled Barley", :blog_id => "grain").id

          mock.proxy(Origin).read(table)

          records = table.records

          retrieved_record_1 = records.find {|t| t.id == record_1_id }
          retrieved_record_1.body.should == "Quinoa"
          retrieved_record_1.blog_id.should == "grain"

          retrieved_record_2 = records.find {|t| t.id == record_2_id }
          retrieved_record_2.body.should == "White Rice"
          retrieved_record_2.blog_id.should == "grain"

          retrieved_record_3 = records.find {|t| t.id == record_3_id }
          retrieved_record_3.body.should == "Pearled Barley"
          retrieved_record_3.blog_id.should == "grain"
        end
      end

      describe "#to_sql" do
        it "returns a select statement for only the columns declared as Columns on the Table" do
          columns = table.columns.map {|a| a.to_sql }.join(", ")
          table.to_sql.should == "select #{columns} from #{table.global_name}"
        end
      end

      describe "#initialize_identity_map" do
        after do
          # verify doubles before the global after clears the identity map, causing an unexpected invocation
          RR::verify_doubles
        end

        it "initializes a thread-local identity map" do
          mock(Thread.current)['blog_posts_identity_map'] = {};
          BlogPost.table.initialize_identity_map
        end
      end

      describe "#identity_map" do
        it "returns the thread-local identity map" do
          mock(Thread.current)['blog_posts_identity_map']
          BlogPost.table.identity_map
        end
      end

      describe "#clear_identity_map" do
        after do
          # verify doubles before the global after clears the identity map, causing an unexpected invocation
          RR::verify_doubles
        end
        
        it "assigns the thread-local identity map to nil" do
          mock(Thread.current)['blog_posts_identity_map'] = nil;
          BlogPost.table.clear_identity_map
        end
      end
    end
  end
end
