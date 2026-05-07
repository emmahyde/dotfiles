# frozen_string_literal: true

# A form object captures form input that doesn't map to a single AR model.
# Use ActiveModel::Model so it works with Rails form helpers (form_with).
# Place under app/forms/.

class ExampleSignupForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :email, :string
  attribute :password, :string
  attribute :company_name, :string
  attribute :accept_terms, :boolean, default: false

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, length: { minimum: 12 }
  validates :company_name, presence: true
  validates :accept_terms, acceptance: true

  attr_reader :user, :company

  def save
    return false unless valid?

    ApplicationRecord.transaction do
      @company = Company.create!(name: company_name)
      @user = User.create!(email: email, password: password, company: @company)
    end

    true
  rescue ActiveRecord::RecordInvalid => e
    errors.add(:base, e.message)
    false
  end
end

# Usage in controller:
#
# class SignupsController < ApplicationController
#   def new
#     @form = ExampleSignupForm.new
#   end
#
#   def create
#     @form = ExampleSignupForm.new(form_params)
#     if @form.save
#       sign_in(@form.user)
#       redirect_to dashboard_path, notice: "Welcome"
#     else
#       render :new, status: :unprocessable_entity
#     end
#   end
#
#   private
#
#   def form_params
#     params.require(:example_signup_form).permit(:email, :password, :company_name, :accept_terms)
#   end
# end
