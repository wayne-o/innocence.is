use sp1_build::build_program_with_args;

fn main() {
    // Build ownership proof program
    build_program_with_args("../program", Default::default());
    
    // Build balance proof program
    build_program_with_args("../balance-proof", Default::default());
}