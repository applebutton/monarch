require File.expand_path("#{File.dirname(__FILE__)}/../../monarch_spec_helper")

module Model
  describe ExposedRepository do
    attr_reader :user, :exposed_repository
    before do
      @user = User.find("jan")
      @exposed_repository = UserRepository.new(user)
    end

    describe ".expose(name, &relation_definition)" do
      it "binds the given relation definition to a table name" do
        exposed_repository.resolve_table_name(:blogs).should == user.blogs
      end
    end

    describe "#get" do
      it "parses the 'relations' paramater from a JSON string into an array of wire representations and performs a #fetch with it, returning the resulting dataset as a JSON string" do
        relations = [{ "type" => "table", "name" => "blog_posts"}]

        dataset = nil
        mock.proxy(exposed_repository).fetch(relations) {|result| dataset = result}
        response = Http::Response.new(*exposed_repository.get({:relations => relations.to_json}))

        response.should be_ok
        response.headers.should == { 'Content-Type' => 'application/json'}
        JSON.parse(response.body).should == { 'successful' => true, 'data' => dataset}
      end
    end

    describe "#post" do
      context "when called with a single create operation" do

        context "when the given field values are valid" do
          it "calls #create on the indicated 'relation' with the given 'field_values', then returns all field values as its result" do
            signed_up_at = Time.now

            field_values = {
              'great_name' => "Sharon Ly",
              'age' => 25,
              'signed_up_at' => signed_up_at.to_millis
            }

            User.new(field_values).should be_valid

            response = Http::Response.new(*exposed_repository.post({
              :operations => {
                'users' => {
                  'create_0' => field_values
                }
              }.to_json
            }))

            new_record = User.find(User[:full_name].eq('Sharon Ly The Great'))

            response.should be_ok
            response.body_from_json.should == {
              'successful' => true,
              'data' => {
                'users' => {
                  'create_0' => {
                    'id' => new_record.id,
                    'full_name' => "Sharon Ly The Great",
                    'age' => 25,
                    'signed_up_at' => signed_up_at.to_millis
                  }
                }
              }
            }
          end
        end

        context "when the given field values are invalid" do
          it "calls #create on the indicated 'relation' with the given 'field_values', then returns all the validation errors as its result" do
            field_values = {
              'full_name' => "Baby Sharon Ly",
              'age' => 2
            }

            invalid_example = User.new(field_values)
            invalid_example.should_not be_valid

            response = Http::Response.new(*exposed_repository.post({
              :operations => {
                'users' => {
                  'create_0' => field_values
                }
              }.to_json
            }))

            User.find(User[:full_name].eq("Baby Sharon Ly")).should be_nil
            
            response.should be_ok
            response.body_from_json.should == {
              'successful' => false,
              'data' => {
                'users' => {
                  'create_0' => {
                    'age' => invalid_example.field(:age).validation_errors,
                  }
                }
              }
            }
          end
        end
      end

      context "when called with a single update operation" do

        context "when the given field values are valid" do
          it "finds the record with the given 'id' in the given 'relation', then updates it with the given field values and returns all changed field values as its result" do
            record = User.find('jan')
            new_signed_up_at = record.signed_up_at - 1.hours

            response = Http::Response.new(*exposed_repository.post({
              :operations => {
                "users" => {
                  "jan" => {
                    'great_name' => "Jan Christian Nelson",
                    'age' => record.age,
                    'signed_up_at' => new_signed_up_at.to_millis
                  }
                }
              }.to_json
            }))

            record.reload
            record.full_name.should == "Jan Christian Nelson The Great"
            record.age.should == 31
            record.signed_up_at.to_millis.should == new_signed_up_at.to_millis

            response.should be_ok
            response.body_from_json.should == {
              'successful' => true,
              'data' => {
                'users' => {
                  'jan' => {
                    'full_name' => "Jan Christian Nelson The Great",
                    'signed_up_at' => new_signed_up_at.to_millis
                  }
                }
              }
            }
          end
        end

        context "when the given field values are invalid" do
          it "returns the validation errors in an unsuccessful response" do
            record = User.find('jan')
            pre_update_age = record.age

            response = Http::Response.new(*exposed_repository.post({
              :operations => {
                "users" => {
                  "jan" => {
                    'age' => 3,
                  }
                }
              }.to_json
            }))

            validation_errors_on_age = record.field(:age).validation_errors
            record.reload
            record.age.should == pre_update_age

            response.should be_ok
            response.body_from_json.should == {
              'successful' => false,
              'data' => {
                'users' => {
                  'jan' => {
                    'age' => validation_errors_on_age,
                  }
                }
              }
            }
          end

        end
      end

      context "when called with a single destroy operation" do
        it "finds the record with the given 'id' in the given 'relation', then destroys it" do
          User.find('jan').should_not be_nil

          response = Http::Response.new(*exposed_repository.post({
            :operations => {
              'users' => {'jan' => nil}
            }.to_json
          }))

          User.find('jan').should be_nil

          response.should be_ok
          response.body_from_json.should == {
            'data' => {
              'users' => {'jan' => nil}
            },
            'successful' => true
          }
        end
      end

      context "when called with multiple operations" do
        it "performs all operations" do
          signed_up_at = Time.now
          User.find('jan').should_not be_nil

          response = Http::Response.new(*exposed_repository.post({
            :operations => {
              'users' => {
                'create_0' => {
                  'full_name' => "Jake Frautschi",
                  'age' => 27,
                  'signed_up_at' => signed_up_at.to_millis
                },
                "jan" => {
                  'age' => 101
                },
                'wil' => nil
              }
            }.to_json
          }))

          jake = User.find(User[:full_name].eq("Jake Frautschi"))
          jake.should_not be_nil
          User.find("jan").age.should == 101
          User.find('wil').should be_nil

          response.should be_ok
          response.body_from_json.should == {
            'data' => {
              'users' => {
                'create_0' => {
                  'id' => jake.id,
                  'full_name' => "Jake Frautschi",
                  'age' => 27,
                  'signed_up_at' => signed_up_at.to_millis
                },
                "jan" => {
                  'age' => 101
                },
                'wil' => nil
              }
            },
            'successful' => true
          }
        end
      end
    end


    describe "#build_relation_from_wire_representation" do
      before do
        publicize exposed_repository, :build_relation_from_wire_representation
      end

      it "delegates to Relation#from_wire_representation with self as the repository" do
        representation = {
          "type" => "table",
          "name" => "blogs"
        }
        mock(Relations::Relation).from_wire_representation(representation, exposed_repository)
        exposed_repository.build_relation_from_wire_representation(representation)
      end


      it "resolves relation names to primitive Tables" do
        relation = exposed_repository.build_relation_from_wire_representation({
          "type" => "table",
          "name" => "blog_posts"
        })
        relation.should == exposed_repository.user.blog_posts
      end
    end

    describe "#fetch" do
      before do
        publicize exposed_repository, :fetch
      end

      it "populates a relational dataset with the contents of an array of wire representations of relations" do
        blogs_relation_representation = {
          "type" => "selection",
          "operand" => {
            "type" => "table",
            "name" => "blogs"
          },
          "predicate" => {
            "type" => "eq",
            "left_operand" => {
              "type" => "column",
              "table" => "blogs",
              "name" => "id"
            },
            "right_operand" => {
              "type" => "scalar",
              "value" => "grain"
            }
          }
        }

        blog_posts_relation_representation = {
          "type" => "selection",
          "operand" => {
            "type" => "table",
            "name" => "blog_posts"
          },
          "predicate" => {
            "type" => "eq",
            "left_operand" => {
              "type" => "column",
              "table" => "blog_posts",
              "name" => "blog_id"
            },
            "right_operand" => {
              "type" => "scalar",
              "value" => "grain"
            }
          }
        }

        dataset = exposed_repository.fetch([blogs_relation_representation, blog_posts_relation_representation])

        blogs_dataset_fragment = dataset["blogs"]
        blogs_dataset_fragment.size.should == 1
        blogs_dataset_fragment["grain"].should == Blog.find("grain").wire_representation
      end

      it "can populate a dataset from exposed projections" do
        super_blog_posts_relation_representation = {
          "type" => "selection",
          "operand" => {
            "type" => "table",
            "name" => "super_blog_posts"
          },
          "predicate" => {
            "type" => "eq",
            "left_operand" => {
              "type" => "column",
              "table" => "super_blog_posts",
              "name" => "user_id"
            },
            "right_operand" => {
              "type" => "scalar",
              "value" => "jan"
            }
          }
        }

        dataset = exposed_repository.fetch([super_blog_posts_relation_representation])
        expected_records = exposed_repository.resolve_table_name(:super_blog_posts).where(Blog[:user_id].eq('jan')).all
        expected_records.should_not be_empty

        expected_records.each do |record|
          dataset['super_blog_posts'][record.id].should == record.wire_representation
        end
      end
    end
  end
end
